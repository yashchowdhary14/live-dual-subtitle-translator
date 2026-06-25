export interface ExtensionFile {
  path: string;
  content: string;
}

export const extensionSources: Record<string, string> = {
  // Manifest
  "manifest.json": `{
  "manifest_version": 3,
  "name": "Live Dual Subtitle Translator",
  "version": "1.0.0",
  "description": "Translates video subtitles in real time and overlays translations above the original subtitles.",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "https://*.youtube.com/*",
    "https://*.netflix.com/*",
    "https://*.primevideo.com/*",
    "https://*.vimeo.com/*",
    "https://*.coursera.org/*",
    "https://*.udemy.com/*",
    "https://*/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": [
        "content/detector.js",
        "content/subtitle-extractor.js",
        "content/translator.js",
        "content/overlay.js"
      ],
      "css": ["content/styles.css"],
      "run_at": "document_end"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html"
  },
  "options_ui": {
    "page": "options/settings.html",
    "open_in_tab": true
  }
}`,

  // Background service worker
  "background.js": `/**
 * Live Dual Subtitle Translator - Background Service Worker
 * Coordinates translations, handles caching, and communicates with AI engines.
 */

// Simple local cache in service worker memory (clears on worker restart, storage handles permanent records)
const translationCache = new Map();

chrome.runtime.onInstalled.addListener(() => {
  console.log("Live Dual Subtitle Translator Extension Installed!");
  
  // Set default settings in Chrome Storage
  chrome.storage.local.set({
    isEnabled: true,
    sourceLang: "auto",
    targetLang: "en",
    showOriginal: true,
    translateOnly: false,
    autoDetect: true,
    lowLatencyMode: false,
    apiProvider: "gemini",
    apiKey: "",
    style: {
      font: "system-ui",
      fontSize: 22,
      fontWeight: "bold",
      textColor: "#ffffff",
      bgColor: "#000000",
      bgOpacity: 75,
      position: "above-original",
      offsetY: -10,
      width: 80,
      borderRadius: 8,
      lineSpacing: 1.4,
      translationOpacity: 100,
      shadowEnabled: true
    },
    translationHistory: []
  });
});

// Listener for messages from Content scripts and Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate") {
    const { text, sourceLang, targetLang, context } = request;
    const cacheKey = \`\${sourceLang}_\${targetLang}_\${text}\`;
    
    // Check background cache
    if (translationCache.has(cacheKey)) {
      sendResponse({ translatedText: translationCache.get(cacheKey), cached: true });
      return true;
    }

    // Perform translation using configured service
    chrome.storage.local.get(["apiProvider", "apiKey", "appUrl"], async (settings) => {
      const provider = settings.apiProvider || "gemini";
      const key = settings.apiKey;
      const appUrl = settings.appUrl || "https://ais-dev-7nnoxisreqjrqtwplgedgf-424127356033.asia-southeast1.run.app"; // Developer app fallback

      try {
        let translatedText = "";

        if (provider === "gemini") {
          // Send request to full-stack secure proxy API (keeps key secure)
          const response = await fetch(\`\${appUrl}/api/translate\`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              text,
              sourceLang,
              targetLang,
              context
            })
          });

          if (!response.ok) {
            throw new Error(\`Server returned status \${response.status}\`);
          }

          const data = await response.json();
          translatedText = data.translatedText;
        } else if (provider === "google") {
          // Standard Google Translate free tier query web scraping proxy
          const url = \`https://translate.googleapis.com/translate_a/single?client=gtx&sl=\${sourceLang === 'auto' ? 'auto' : sourceLang}&tl=\${targetLang}&dt=t&q=\${encodeURIComponent(text)}\`;
          const res = await fetch(url);
          const data = await res.json();
          translatedText = data[0].map(x => x[0]).join("");
        } else {
          // Mock translation or default translation fallback
          translatedText = \`[\${targetLang.toUpperCase()}] \${text}\`;
        }

        // Cache the translation
        translationCache.set(cacheKey, translatedText);
        
        // Save to History in Storage
        saveHistoryItem(text, translatedText, sourceLang, targetLang);

        sendResponse({ translatedText, success: true });
      } catch (err) {
        console.error("Translation Error in Background Worker:", err);
        sendResponse({ 
          translatedText: \`[Translation Error: \${err.message}]\`, 
          success: false, 
          error: err.message 
        });
      }
    });

    return true; // Required for async response
  }
});

function saveHistoryItem(original, translated, source, target) {
  chrome.storage.local.get(["translationHistory"], (result) => {
    let history = result.translationHistory || [];
    const newItem = {
      id: "hist_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      timestamp: new Date().toLocaleTimeString(),
      videoTitle: "Active Video",
      original,
      translated,
      sourceLang: source,
      targetLang: target
    };
    
    // Cap history at 100 items
    history.unshift(newItem);
    if (history.length > 100) history.pop();
    
    chrome.storage.local.set({ translationHistory: history });
  });
}`,

  // Content script: detector.js
  "content/detector.js": `/**
 * Live Dual Subtitle Translator - Universal Video Detector
 * Scans, detects, and watches active video elements.
 */

class UniversalVideoDetector {
  constructor() {
    this.activeVideo = null;
    this.detectInterval = null;
    this.init();
  }

  init() {
    this.startDetectionLoop();
    this.setupURLWatcher();
  }

  startDetectionLoop() {
    // Poll to detect newly loaded videos (useful for SPAs like YouTube/Netflix)
    this.detectInterval = setInterval(() => {
      this.detectActiveVideo();
    }, 1500);
  }

  detectActiveVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) {
      if (this.activeVideo) {
        this.activeVideo = null;
        this.emitVideoEvent("videodetached");
      }
      return;
    }

    // Prefer video that is currently playing and is largest on screen
    let bestVideo = videos.find(v => !v.paused) || videos[0];
    
    if (bestVideo && bestVideo !== this.activeVideo) {
      this.activeVideo = bestVideo;
      this.emitVideoEvent("videoattached", { video: this.activeVideo });
      this.setupVideoListeners(this.activeVideo);
    }
  }

  setupVideoListeners(video) {
    video.addEventListener("play", () => this.emitVideoEvent("videoplay"));
    video.addEventListener("pause", () => this.emitVideoEvent("videopause"));
    video.addEventListener("seeking", () => this.emitVideoEvent("videoseeking"));
    video.addEventListener("seeked", () => this.emitVideoEvent("videoseeked"));
  }

  setupURLWatcher() {
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        this.emitVideoEvent("urlchanged", { url: lastUrl });
        // Re-detect immediately
        setTimeout(() => this.detectActiveVideo(), 500);
      }
    });
    observer.observe(document, { subtree: true, childList: true });
  }

  emitVideoEvent(eventName, detail = {}) {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    console.log(\`[Translator Detector] Event: \${eventName}\`, detail);
  }
}

// Instantiate detector
window.videoDetector = new UniversalVideoDetector();`,

  // Content script: subtitle-extractor.js
  "content/subtitle-extractor.js": `/**
 * Live Dual Subtitle Translator - Subtitle Extraction Engine
 * Extract original captions from Netflix, YouTube, Vimeo, or standard HTML5 video subtitles.
 */

class SubtitleExtractor {
  constructor() {
    this.observer = null;
    this.currentPlatform = "generic";
    this.lastSubtitleText = "";
    this.init();
  }

  init() {
    this.detectPlatform();
    
    // Listen to video attachment
    window.addEventListener("videoattached", (e) => {
      this.setupExtraction(e.detail.video);
    });

    // Run immediate check
    this.detectPlatform();
    this.startDOMObserver();
  }

  detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("youtube.com")) {
      this.currentPlatform = "youtube";
    } else if (host.includes("netflix.com")) {
      this.currentPlatform = "netflix";
    } else if (host.includes("primevideo.com")) {
      this.currentPlatform = "primevideo";
    } else if (host.includes("vimeo.com")) {
      this.currentPlatform = "vimeo";
    } else {
      this.currentPlatform = "generic";
    }
  }

  setupExtraction(video) {
    console.log(\`[Subtitle Extractor] Hooking into platform: \${this.currentPlatform}\`);
    this.startDOMObserver();
  }

  startDOMObserver() {
    if (this.observer) this.observer.disconnect();

    // Select the target subtitle container selector based on the platform
    let targetSelector = "";
    if (this.currentPlatform === "youtube") {
      targetSelector = ".ytp-caption-window-container";
    } else if (this.currentPlatform === "netflix") {
      targetSelector = ".player-timedText-container, .player-timed-text";
    } else if (this.currentPlatform === "primevideo") {
      targetSelector = ".atvwebplayersdk-subtitle-text, .atvwebplayersdk-subtitles-container";
    } else {
      // Universal generic HTML5 selectors
      targetSelector = ".caption-container, .video-subtitles, .subtitles, .vjs-text-track-display";
    }

    if (!targetSelector) return;

    // Check DOM periodically for existence of subtitle element
    const scanContainer = () => {
      const element = document.querySelector(targetSelector);
      if (element) {
        this.hookDOMElement(element);
      } else {
        // Fallback: observe body for container creation
        this.hookDOMElement(document.body);
      }
    };

    scanContainer();
    // Re-scan regularly
    setInterval(scanContainer, 3000);
  }

  hookDOMElement(element) {
    if (element._isObservedByTranslator) return;
    element._isObservedByTranslator = true;

    this.observer = new MutationObserver(() => {
      this.extractTextFromDOM();
    });

    this.observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  extractTextFromDOM() {
    let captionText = "";

    if (this.currentPlatform === "youtube") {
      // Extract caption chunks from YouTube's visual overlays
      const segments = Array.from(document.querySelectorAll(".ytp-caption-segment"));
      captionText = segments.map(seg => seg.innerText.trim()).join(" ");
    } else if (this.currentPlatform === "netflix") {
      const container = document.querySelector(".player-timedText-container, .player-timed-text");
      if (container) captionText = container.innerText.trim();
    } else if (this.currentPlatform === "primevideo") {
      const container = document.querySelector(".atvwebplayersdk-subtitle-text");
      if (container) captionText = container.innerText.trim();
    } else {
      // Generic fallback
      const divs = Array.from(document.querySelectorAll(".caption-container, .vjs-text-track-display"));
      captionText = divs.map(d => d.innerText.trim()).filter(Boolean).join(" ");
    }

    // Clean up carriage returns, multi-spaces
    captionText = captionText.replace(/\\s+/g, " ").trim();

    // Trigger update if caption text has changed and is not empty
    if (captionText && captionText !== this.lastSubtitleText) {
      this.lastSubtitleText = captionText;
      window.dispatchEvent(new CustomEvent("subtitleextracted", {
        detail: { text: captionText }
      }));
    }
  }
}

// Instantiate extractor
window.subtitleExtractor = new SubtitleExtractor();`,

  // Content script: translator.js
  "content/translator.js": `/**
 * Live Dual Subtitle Translator - Client-Side Translation Bridge
 * Coordinates translation caching, language preferences, and debounces.
 */

class TranslationCoordinator {
  constructor() {
    this.settings = null;
    this.isTranslating = false;
    this.lastOriginalText = "";
    this.contextHistory = []; // Track past 3 subtitles for context-aware translations
    this.init();
  }

  async init() {
    await this.loadSettings();

    // Listen to settings update
    chrome.storage.onChanged.addListener((changes) => {
      this.loadSettings();
    });

    // Listen to subtitles extracted
    window.addEventListener("subtitleextracted", (e) => {
      this.handleNewSubtitle(e.detail.text);
    });
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        "isEnabled",
        "sourceLang",
        "targetLang",
        "showOriginal",
        "translateOnly",
        "lowLatencyMode"
      ], (items) => {
        this.settings = items;
        resolve();
      });
    });
  }

  handleNewSubtitle(text) {
    if (!this.settings || !this.settings.isEnabled) return;
    if (text === this.lastOriginalText) return;
    
    this.lastOriginalText = text;

    // Maintain a small dialog context of past lines (sliding window)
    this.contextHistory.push(text);
    if (this.contextHistory.length > 4) {
      this.contextHistory.shift();
    }

    const context = this.contextHistory.slice(0, -1).join(" | ");

    // Call service worker to do the translation
    chrome.runtime.sendMessage({
      action: "translate",
      text: text,
      sourceLang: this.settings.sourceLang || "auto",
      targetLang: this.settings.targetLang || "en",
      context: context
    }, (response) => {
      if (response && response.translatedText) {
        // Dispatch translation to overlay renderer
        window.dispatchEvent(new CustomEvent("subtitletranslated", {
          detail: {
            originalText: text,
            translatedText: response.translatedText,
            sourceLang: this.settings.sourceLang,
            targetLang: this.settings.targetLang
          }
        }));
      }
    });
  }
}

// Instantiate translation coordinator
window.translationCoordinator = new TranslationCoordinator();`,

  // Content script: overlay.js
  "content/overlay.js": `/**
 * Live Dual Subtitle Translator - Overlay UI
 * Beautiful Shadow-DOM overlay rendered directly on the video container.
 */

class SubtitleOverlayManager {
  constructor() {
    this.overlayContainer = null;
    this.styleConfig = null;
    this.init();
  }

  async init() {
    await this.loadStyles();

    // Re-load styles when changed
    chrome.storage.onChanged.addListener(() => {
      this.loadStyles();
    });

    // Listen to translated subtitle events
    window.addEventListener("subtitletranslated", (e) => {
      this.renderSubtitle(e.detail.originalText, e.detail.translatedText);
    });

    // Handle Fullscreen events to keep overlay in front
    document.addEventListener("fullscreenchange", () => this.handleFullscreenChange());
  }

  async loadStyles() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["style", "showOriginal", "translateOnly"], (result) => {
        this.styleConfig = result.style;
        this.showOriginal = result.showOriginal !== false;
        this.translateOnly = result.translateOnly || false;
        
        // Refresh styles on active overlay
        if (this.overlayContainer) {
          this.applyStyleConfig();
        }
        resolve();
      });
    });
  }

  createOverlayContainer() {
    // Find the active video element
    const video = document.querySelector("video");
    if (!video) return null;

    // Video parent container (preferred target)
    const container = video.parentElement || document.body;

    // Check if we already created it
    let wrapper = container.querySelector("#dual-subtitle-overlay-root");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "dual-subtitle-overlay-root";
      wrapper.style.position = "absolute";
      wrapper.style.zIndex = "999999";
      wrapper.style.left = "0";
      wrapper.style.right = "0";
      wrapper.style.pointerEvents = "none";
      container.appendChild(wrapper);

      // Create Shadow DOM to protect from host styles
      const shadow = wrapper.attachShadow({ mode: "open" });
      
      const innerContainer = document.createElement("div");
      innerContainer.id = "overlay-box";
      shadow.appendChild(innerContainer);
      
      this.overlayContainer = innerContainer;
    }

    return this.overlayContainer;
  }

  applyStyleConfig() {
    if (!this.overlayContainer || !this.styleConfig) return;

    const style = this.styleConfig;
    const shadowRoot = this.overlayContainer.getRootNode();
    
    // Inject CSS styles into the Shadow DOM
    let styleTag = shadowRoot.querySelector("style");
    if (!styleTag) {
      styleTag = document.createElement("style");
      shadowRoot.appendChild(styleTag);
    }

    // Convert hex bg to rgba for opacity
    const hex = style.bgColor || "#000000";
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    const bgOpacity = (style.bgOpacity !== undefined ? style.bgOpacity : 75) / 100;
    const rgbaBg = \`rgba(\${r}, \${g}, \${b}, \${bgOpacity})\`;

    // Responsive sizing logic
    styleTag.textContent = \`
      #overlay-box {
        position: absolute;
        width: \${style.width || 80}%;
        left: 50%;
        transform: translateX(-50%);
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 10000;
      }

      .caption-segment {
        font-family: \${style.font || 'system-ui'}, sans-serif;
        font-size: \${style.fontSize || 22}px;
        font-weight: \${style.fontWeight || 'bold'};
        padding: 6px 14px;
        margin: 4px 0;
        border-radius: \${style.borderRadius || 8}px;
        background-color: \${rgbaBg};
        line-height: \${style.lineSpacing || 1.4};
        text-shadow: \${style.shadowEnabled ? '1px 1px 3px rgba(0,0,0,0.8), -1px -1px 3px rgba(0,0,0,0.8)' : 'none'};
        max-width: 90%;
        word-wrap: break-word;
        animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .translated-text {
        color: \${style.textColor || '#ffffff'};
        opacity: \${(style.translationOpacity || 100) / 100};
      }

      .original-text {
        color: rgba(255, 255, 255, 0.85);
        font-size: 85%;
        border-top: 1px solid rgba(255, 255, 255, 0.15);
        padding-top: 2px;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    \`;

    // Position overlay vertically relative to the video height
    const video = document.querySelector("video");
    const wrapper = document.querySelector("#dual-subtitle-overlay-root");
    
    if (video && wrapper) {
      const rect = video.getBoundingClientRect();
      wrapper.style.top = rect.top + window.scrollY + "px";
      wrapper.style.height = rect.height + "px";
      wrapper.style.width = rect.width + "px";
      wrapper.style.left = rect.left + window.scrollX + "px";

      // Set vertical placement inside wrapper
      const offset = style.offsetY || 0;
      if (style.position === "top") {
        this.overlayContainer.style.top = (20 + offset) + "px";
        this.overlayContainer.style.bottom = "auto";
      } else if (style.position === "middle") {
        this.overlayContainer.style.top = "50%";
        this.overlayContainer.style.transform = "translate(-50%, -50%)";
        this.overlayContainer.style.bottom = "auto";
      } else if (style.position === "above-original") {
        // Place just above where standard subtitles normally live (approx 70% height)
        this.overlayContainer.style.bottom = (90 - offset) + "px";
        this.overlayContainer.style.top = "auto";
      } else { // bottom
        this.overlayContainer.style.bottom = (30 + offset) + "px";
        this.overlayContainer.style.top = "auto";
      }
    }
  }

  renderSubtitle(original, translated) {
    const container = this.createOverlayContainer();
    if (!container) return;

    this.applyStyleConfig();

    // Clear contents
    container.innerHTML = "";

    // Translated Overlay Segment
    const translatedEl = document.createElement("div");
    translatedEl.className = "caption-segment translated-text";
    translatedEl.innerText = translated;
    container.appendChild(translatedEl);

    // Original Overlay Segment (Optional)
    if (this.showOriginal && !this.translateOnly) {
      const originalEl = document.createElement("div");
      originalEl.className = "caption-segment original-text";
      originalEl.innerText = original;
      container.appendChild(originalEl);
    }
  }

  handleFullscreenChange() {
    // Keep overlay bound on active video during state switches
    setTimeout(() => {
      this.applyStyleConfig();
    }, 500);
  }
}

// Instantiate overlay manager
window.subtitleOverlayManager = new SubtitleOverlayManager();`,

  // Subtitle Overlay static styling
  "content/styles.css": `/* Isolated custom subtitle styles for background cases */
#dual-subtitle-overlay-root {
  pointer-events: none !important;
}`,

  // Popup HTML
  "popup/popup.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dual Subtitle Translator Popup</title>
  <style>
    body {
      width: 320px;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
      background-color: #f5f5f7;
      color: #1d1d1f;
      -webkit-font-smoothing: antialiased;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background-color: #ffffff;
      border-bottom: 1px solid #e5e5ea;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo-container h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #007aff;
    }
    .switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #d1d1d6;
      transition: .2s;
      border-radius: 24px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .2s;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }
    input:checked + .slider {
      background-color: #34c759;
    }
    input:checked + .slider:before {
      transform: translateX(20px);
    }
    .section {
      padding: 16px;
      background-color: #ffffff;
      margin-top: 10px;
      border-top: 1px solid #e5e5ea;
      border-bottom: 1px solid #e5e5ea;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #8e8e93;
      margin-bottom: 12px;
    }
    .form-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .form-group:last-child {
      margin-bottom: 0;
    }
    label {
      font-size: 14px;
      font-weight: 500;
    }
    select {
      background-color: #f5f5f7;
      border: 1px solid #d1d1d6;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 13px;
      color: #1d1d1f;
      outline: none;
      width: 140px;
    }
    .btn-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 16px;
    }
    button {
      padding: 10px;
      border-radius: 10px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background-color: #007aff;
      color: white;
    }
    .btn-primary:hover {
      background-color: #0063cc;
    }
    .btn-secondary {
      background-color: #e5e5ea;
      color: #1d1d1f;
    }
    .btn-secondary:hover {
      background-color: #d1d1d6;
    }
    .status-bar {
      display: flex;
      justify-content: space-between;
      padding: 8px 16px;
      background-color: #f5f5f7;
      border-top: 1px solid #e5e5ea;
      font-size: 11px;
      color: #8e8e93;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-container">
      <h2>Dual Subtitle API</h2>
    </div>
    <label class="switch">
      <input type="checkbox" id="toggle-active" checked>
      <span class="slider"></span>
    </label>
  </div>

  <div class="section">
    <div class="section-title">Language Preferences</div>
    <div class="form-group">
      <label for="source-lang">Original Audio</label>
      <select id="source-lang">
        <option value="auto">Auto Detect</option>
        <option value="German">German</option>
        <option value="Spanish">Spanish</option>
        <option value="French">French</option>
        <option value="Hindi">Hindi</option>
        <option value="Japanese">Japanese</option>
      </select>
    </div>
    <div class="form-group">
      <label for="target-lang">Translate To</label>
      <select id="target-lang">
        <option value="en">English</option>
        <option value="es">Spanish</option>
        <option value="fr">French</option>
        <option value="hi">Hindi</option>
        <option value="German">German</option>
      </select>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Display Mode</div>
    <div class="form-group">
      <label for="display-mode">Overlay Settings</label>
      <select id="display-mode">
        <option value="dual">Dual Subtitles</option>
        <option value="translate-only">Translation Only</option>
      </select>
    </div>
    <div class="form-group">
      <label for="latency-mode">Low Latency</label>
      <label class="switch" style="width:36px; height:20px;">
        <input type="checkbox" id="toggle-latency">
        <span class="slider" style="border-radius:20px;"></span>
      </label>
    </div>
  </div>

  <div class="btn-group">
    <button class="btn-primary" id="open-settings">Customize Styles</button>
    <button class="btn-secondary" id="clear-cache">Reset Cache</button>
  </div>

  <div class="status-bar">
    <span id="provider-status">Engine: Gemini AI</span>
    <span id="latency-val">Latency: &lt;150ms</span>
  </div>

  <script src="popup.js"></script>
</body>
</html>`,

  // Popup logic
  "popup/popup.js": `/**
 * Live Dual Subtitle Translator - Popup Page Controller
 * Syncs simple inputs with storage.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const toggleActive = document.getElementById("toggle-active");
  const sourceLang = document.getElementById("source-lang");
  const targetLang = document.getElementById("target-lang");
  const displayMode = document.getElementById("display-mode");
  const toggleLatency = document.getElementById("toggle-latency");
  const openSettings = document.getElementById("open-settings");
  const clearCache = document.getElementById("clear-cache");
  const providerStatus = document.getElementById("provider-status");

  // Load values from Storage
  chrome.storage.local.get([
    "isEnabled",
    "sourceLang",
    "targetLang",
    "translateOnly",
    "lowLatencyMode",
    "apiProvider"
  ], (items) => {
    toggleActive.checked = items.isEnabled !== false;
    sourceLang.value = items.sourceLang || "auto";
    targetLang.value = items.targetLang || "en";
    displayMode.value = items.translateOnly ? "translate-only" : "dual";
    toggleLatency.checked = items.lowLatencyMode || false;
    
    const engine = items.apiProvider || "gemini";
    providerStatus.innerText = \`Engine: \${engine.toUpperCase()}\`;
  });

  // Bind Listeners
  toggleActive.addEventListener("change", () => {
    chrome.storage.local.set({ isEnabled: toggleActive.checked });
  });

  sourceLang.addEventListener("change", () => {
    chrome.storage.local.set({ sourceLang: sourceLang.value });
  });

  targetLang.addEventListener("change", () => {
    chrome.storage.local.set({ targetLang: targetLang.value });
  });

  displayMode.addEventListener("change", () => {
    chrome.storage.local.set({ translateOnly: displayMode.value === "translate-only" });
  });

  toggleLatency.addEventListener("change", () => {
    chrome.storage.local.set({ lowLatencyMode: toggleLatency.checked });
  });

  openSettings.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  clearCache.addEventListener("click", () => {
    chrome.storage.local.set({ translationHistory: [] }, () => {
      alert("Translation history and style cache cleared successfully.");
    });
  });
});`,

  // Options page HTML
  "options/settings.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dual Subtitle Translator Options & Settings</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f5f5f7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1d1d1f;
    }
    .container {
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .header {
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px 0;
      color: #007aff;
    }
    .header p {
      margin: 0;
      color: #8e8e93;
      font-size: 16px;
    }
    .card {
      background-color: #ffffff;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .card-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 20px 0;
      border-bottom: 1px solid #f2f2f7;
      padding-bottom: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    label {
      font-size: 13px;
      font-weight: 600;
      color: #8e8e93;
      text-transform: uppercase;
    }
    input[type="text"], input[type="password"], input[type="number"], select {
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #d1d1d6;
      font-size: 14px;
      background-color: #f5f5f7;
      color: #1d1d1f;
      outline: none;
    }
    input[type="text"]:focus, select:focus {
      border-color: #007aff;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
    }
    button {
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
    }
    .btn-save {
      background-color: #007aff;
      color: #ffffff;
    }
    .btn-save:hover {
      background-color: #0063cc;
    }
    .btn-import {
      background-color: #e5e5ea;
      color: #1d1d1f;
    }
    .btn-import:hover {
      background-color: #d1d1d6;
    }
    .subtitle-preview-box {
      margin-top: 20px;
      padding: 30px;
      border-radius: 12px;
      background-color: #000000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      position: relative;
      overflow: hidden;
      min-height: 120px;
    }
    .preview-text-translated {
      font-size: 22px;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      z-index: 2;
    }
    .preview-text-original {
      font-size: 18px;
      color: rgba(255, 255, 255, 0.7);
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 4px;
      z-index: 2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Dual Subtitle Translator Dashboard</h1>
      <p>Configure translation API providers, custom typography, fonts, colors, and overlays.</p>
    </div>

    <!-- API configuration -->
    <div class="card">
      <h2 class="card-title">Translation Service Engine</h2>
      <div class="grid">
        <div class="form-group">
          <label for="api-provider">Provider</label>
          <select id="api-provider">
            <option value="gemini">Gemini AI Model (Full-stack Proxy)</option>
            <option value="google">Google Translate API (No Key Required)</option>
          </select>
        </div>
        <div class="form-group" id="key-wrapper">
          <label for="api-key">Service API Key</label>
          <input type="password" id="api-key" placeholder="Enter API Key (Optional for proxy)">
        </div>
      </div>
    </div>

    <!-- Custom Typography overlay -->
    <div class="card">
      <h2 class="card-title">Caption Overlay Style & Layout</h2>
      <div class="grid">
        <div class="form-group">
          <label for="font-family">Font Family</label>
          <select id="font-family">
            <option value="SF Pro Text">Inter / SF Pro</option>
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Georgia">Georgia Serif</option>
            <option value="Impact">Impact Heavy</option>
          </select>
        </div>
        <div class="form-group">
          <label for="font-size">Font Size (px)</label>
          <input type="number" id="font-size" value="22" min="14" max="42">
        </div>
        <div class="form-group">
          <label for="text-color">Overlay Text Color</label>
          <input type="text" id="text-color" value="#ffffff">
        </div>
        <div class="form-group">
          <label for="bg-opacity">Background Opacity (%)</label>
          <input type="number" id="bg-opacity" value="75" min="0" max="100">
        </div>
      </div>

      <div class="subtitle-preview-box">
        <div class="preview-text-translated" id="prev-trans">Good morning, how are you?</div>
        <div class="preview-text-original" id="prev-orig">Guten Morgen, wie geht es dir?</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn-import" id="btn-export">Export Config</button>
      <button class="btn-save" id="btn-save-settings">Save Configurations</button>
    </div>
  </div>

  <script src="settings.js"></script>
</body>
</html>`,

  // Options settings logic
  "options/settings.js": `/**
 * Live Dual Subtitle Translator - Settings Dashboard Logic
 * Saves styles and API settings in local storage.
 */

document.addEventListener("DOMContentLoaded", () => {
  const providerSelect = document.getElementById("api-provider");
  const apiKeyInput = document.getElementById("api-key");
  const fontFamilySelect = document.getElementById("font-family");
  const fontSizeInput = document.getElementById("font-size");
  const textColorInput = document.getElementById("text-color");
  const bgOpacityInput = document.getElementById("bg-opacity");
  
  const prevTrans = document.getElementById("prev-trans");
  const btnSave = document.getElementById("btn-save-settings");
  const btnExport = document.getElementById("btn-export");

  // Load Saved Values
  chrome.storage.local.get(["apiProvider", "apiKey", "style"], (items) => {
    providerSelect.value = items.apiProvider || "gemini";
    apiKeyInput.value = items.apiKey || "";
    
    if (items.style) {
      fontFamilySelect.value = items.style.font || "SF Pro Text";
      fontSizeInput.value = items.style.fontSize || 22;
      textColorInput.value = items.style.textColor || "#ffffff";
      bgOpacityInput.value = items.style.bgOpacity || 75;
      updatePreview();
    }
  });

  // Event to update preview styles
  const inputs = [fontFamilySelect, fontSizeInput, textColorInput, bgOpacityInput];
  inputs.forEach(input => {
    input.addEventListener("input", updatePreview);
  });

  function updatePreview() {
    prevTrans.style.fontFamily = fontFamilySelect.value;
    prevTrans.style.fontSize = fontSizeInput.value + "px";
    prevTrans.style.color = textColorInput.value;
  }

  btnSave.addEventListener("click", () => {
    chrome.storage.local.get(["style"], (result) => {
      const currentStyle = result.style || {};
      const newStyle = {
        ...currentStyle,
        font: fontFamilySelect.value,
        fontSize: parseInt(fontSizeInput.value),
        textColor: textColorInput.value,
        bgOpacity: parseInt(bgOpacityInput.value)
      };

      chrome.storage.local.set({
        apiProvider: providerSelect.value,
        apiKey: apiKeyInput.value,
        style: newStyle
      }, () => {
        alert("Dual Subtitle Settings Saved Successfully!");
      });
    });
  });

  btnExport.addEventListener("click", () => {
    chrome.storage.local.get(null, (allData) => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "translator_config.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  });
});`
};
