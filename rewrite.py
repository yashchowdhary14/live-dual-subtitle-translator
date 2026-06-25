import os

manifest = """{
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
    "https://*.videasy.to/*",
    "https://*.7reels.cc/*",
    "https://*/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "all_frames": true,
      "match_about_blank": true,
      "js": [
        "content/logger.js",
        "content/site-profiles.js",
        "content/detector.js",
        "content/health-monitor.js",
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
}"""

background = """/**
 * Live Dual Subtitle Translator - Background Service Worker
 * Coordinates translations, handles caching, and communicates with AI engines.
 */

const translationCache = new Map();

chrome.runtime.onInstalled.addListener(() => {
  console.log("Live Dual Subtitle Translator Extension Installed!");
  
  chrome.storage.local.set({
    isEnabled: true,
    sourceLang: "auto",
    targetLang: "en",
    showOriginal: true,
    translateOnly: false,
    autoDetect: true,
    lowLatencyMode: false,
    apiProvider: "google",
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate") {
    const { text, sourceLang, targetLang, context } = request;
    const cacheKey = `${sourceLang}_${targetLang}_${text}`;
    
    if (translationCache.has(cacheKey)) {
      sendResponse({ translatedText: translationCache.get(cacheKey), cached: true });
      return true;
    }

    chrome.storage.local.get(["apiProvider", "apiKey", "appUrl"], async (settings) => {
      const provider = settings.apiProvider || "google";
      const key = settings.apiKey;
      const appUrl = settings.appUrl || "https://ais-dev-7nnoxisreqjrqtwplgedgf-424127356033.asia-southeast1.run.app"; 

      try {
        let translatedText = "";

        if (provider === "gemini") {
          try {
            const response = await fetch(`${appUrl}/api/translate`, {
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
              throw new Error(`Server returned status ${response.status}`);
            }

            const data = await response.json();
            translatedText = data.translatedText;
          } catch (geminiErr) {
            console.warn("Gemini API failed, falling back to Google Translate. Error:", geminiErr);
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang === 'auto' ? 'auto' : sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            const data = await res.json();
            translatedText = data[0].map(x => x[0]).join("");
          }
        } else if (provider === "google") {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang === 'auto' ? 'auto' : sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
          const res = await fetch(url);
          const data = await res.json();
          translatedText = data[0].map(x => x[0]).join("");
        } else {
          translatedText = `[${targetLang.toUpperCase()}] ${text}`;
        }

        translationCache.set(cacheKey, translatedText);
        saveHistoryItem(text, translatedText, sourceLang, targetLang);

        sendResponse({ translatedText, success: true });
      } catch (err) {
        console.error("Translation Error in Background Worker:", err);
        sendResponse({ 
          translatedText: `[Translation Error: ${err.message}]`, 
          success: false, 
          error: err.message 
        });
      }
    });

    return true; 
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
    
    history.unshift(newItem);
    if (history.length > 100) history.pop();
    
    chrome.storage.local.set({ translationHistory: history });
  });
}"""

logger = """/**
 * Live Dual Subtitle Translator - Debug Logger
 */
class SubtitleLogger {
  log(prefix, ...args) {
    if (window.__subtitleDebug) {
      console.log(`%c[${prefix}]`, 'color: #34c759; font-weight: bold;', ...args);
    }
  }
  error(prefix, ...args) {
    if (window.__subtitleDebug) {
      console.error(`%c[${prefix}]`, 'color: #ff3b30; font-weight: bold;', ...args);
    }
  }
}
window.subtitleLogger = new SubtitleLogger();"""

site_profiles = """/**
 * Live Dual Subtitle Translator - Site Profiles
 */
window.siteProfiles = {
  getProfile: function(hostname) {
    const profiles = [
      {
        id: "7reels",
        domains: ["7reels.cc", "player.videasy.to", "videasy.to"],
        selectors: [
          ".caption", ".captions", ".subtitle", ".subtitles", 
          ".vjs-text-track-display", ".jw-text-track-container",
          ".shaka-text-container", ".plyr__captions",
          "[class*='caption']", "[class*='subtitle']", "[class*='text-track']"
        ],
        priority: "DOM"
      }
    ];
    for (let p of profiles) {
      for (let d of p.domains) {
        if (hostname.includes(d)) return p;
      }
    }
    return {
      id: "generic",
      domains: [],
      selectors: [
        ".caption-container", ".video-subtitles", ".subtitles", ".subtitle", ".caption", ".captions",
        ".vjs-text-track-display", ".jw-text-track-container",
        ".shaka-text-container", ".plyr__captions",
        "[data-subtitle]", "[aria-live]"
      ],
      priority: "ALL"
    };
  }
};"""

detector = """/**
 * Live Dual Subtitle Translator - Universal Video Detector
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
    this.detectInterval = setInterval(() => {
      this.detectActiveVideo();
    }, 1500);
  }

  detectActiveVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) {
      if (this.activeVideo) {
        window.subtitleLogger.log("Detector", "Video detached");
        this.activeVideo = null;
        this.emitVideoEvent("videodetached");
      }
      return;
    }

    let bestVideo = videos.find(v => !v.paused) || videos[0];
    
    if (bestVideo && bestVideo !== this.activeVideo) {
      window.subtitleLogger.log("Detector", "Video attached", bestVideo);
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
        window.subtitleLogger.log("Detector", "URL changed", lastUrl);
        this.emitVideoEvent("urlchanged", { url: lastUrl });
        setTimeout(() => this.detectActiveVideo(), 500);
      }
    });
    observer.observe(document, { subtree: true, childList: true });
  }

  emitVideoEvent(eventName, detail = {}) {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

window.videoDetector = new UniversalVideoDetector();"""

extractor = """/**
 * Live Dual Subtitle Translator - Subtitle Extraction Engine
 */
class SubtitleExtractor {
  constructor() {
    this.observer = null;
    this.profile = window.siteProfiles.getProfile(window.location.hostname);
    this.lastSubtitleText = "";
    this.cuesBound = false;
    this.init();
  }

  init() {
    window.subtitleLogger.log("Extractor", "Init with profile:", this.profile.id);
    window.addEventListener("videoattached", (e) => {
      this.setupExtraction(e.detail.video);
    });
    this.startExtractionLoop();
  }

  setupExtraction(video) {
    this.bindNativeTracks(video);
  }

  bindNativeTracks(video) {
    if (this.cuesBound || !video.textTracks) return;
    this.cuesBound = true;
    
    const bindToTracks = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        let track = video.textTracks[i];
        if (!track._isBound) {
          track._isBound = true;
          track.addEventListener('cuechange', () => {
            this.extractFromActiveCues(track);
          });
          window.subtitleLogger.log("Extractor", "Bound cuechange to track", track);
        }
      }
    };
    
    bindToTracks();
    video.addEventListener('loadedmetadata', bindToTracks);
    video.textTracks.addEventListener('addtrack', bindToTracks);
  }

  extractFromActiveCues(track) {
    let captionText = "";
    if (track.activeCues && track.activeCues.length > 0) {
      for (let j = 0; j < track.activeCues.length; j++) {
        captionText += track.activeCues[j].text + " ";
      }
    }
    this.emitText(captionText);
  }

  startExtractionLoop() {
    if (this.observer) this.observer.disconnect();

    // D. MutationObserver Fallback
    this.observer = new MutationObserver(() => {
      this.extractTextFromDOM();
    });
    this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    
    setInterval(() => this.extractTextFromDOM(), 1000);
  }

  extractTextFromDOM() {
    let captionText = "";
    
    // A. Check HTML5 video textTracks if cuechange missed it
    const videos = document.querySelectorAll('video');
    for (let v of videos) {
      if (v.textTracks) {
        for (let i = 0; i < v.textTracks.length; i++) {
          let track = v.textTracks[i];
          if (track.mode === 'showing' || track.mode === 'hidden') {
            if (track.activeCues && track.activeCues.length > 0) {
              for (let j = 0; j < track.activeCues.length; j++) {
                captionText += track.activeCues[j].text + " ";
              }
            }
          }
        }
      }
    }

    // B & C. Check overlay containers and Shadow DOM
    if (!captionText.trim()) {
      const selectors = this.profile.selectors;
      
      const findSubtitles = (root) => {
        let text = "";
        for (let sel of selectors) {
          const els = root.querySelectorAll(sel);
          for (let el of els) {
            text += el.textContent + " ";
          }
        }
        const allEls = root.querySelectorAll("*");
        for (let el of allEls) {
          if (el.shadowRoot) {
            text += findSubtitles(el.shadowRoot);
          }
        }
        return text;
      };
      captionText += findSubtitles(document);
    }

    this.emitText(captionText);
  }
  
  emitText(captionText) {
    captionText = captionText.replace(/\s+/g, " ").trim();

    if (captionText && captionText !== this.lastSubtitleText) {
      // Basic static page text filter
      if (captionText.length > 200 || captionText.split(' ').length > 30) {
        // likely static layout text, ignore
        return;
      }
      window.subtitleLogger.log("Extractor", "Extracted:", captionText);
      this.lastSubtitleText = captionText;
      window.dispatchEvent(new CustomEvent("subtitleextracted", {
        detail: { text: captionText }
      }));
    }
  }
}

window.subtitleExtractor = new SubtitleExtractor();"""

health_monitor = """/**
 * Live Dual Subtitle Translator - Health Monitoring & Status UI
 */
class HealthMonitor {
  constructor() {
    this.state = {
      videoDetected: false,
      subtitleDetected: false,
      translationRunning: false,
      overlayRendered: false,
      lastSubtitleTimestamp: 0,
      lastTranslationTimestamp: 0,
      subtitleRate: 0
    };
    
    this.debugExpanded = false;
    this.badgeContainer = null;
    this.init();
  }

  init() {
    this.createBadge();
    
    window.addEventListener("videoattached", () => {
      this.state.videoDetected = true;
      this.updateState();
    });
    window.addEventListener("videodetached", () => {
      this.state.videoDetected = false;
      this.updateState();
    });
    
    window.addEventListener("subtitleextracted", (e) => {
      if (e.detail.text.trim()) {
        this.state.subtitleDetected = true;
        this.state.lastSubtitleTimestamp = Date.now();
        this.updateState();
      }
    });
    
    window.addEventListener("subtitletranslated", () => {
      this.state.translationRunning = true;
      this.state.lastTranslationTimestamp = Date.now();
      this.state.overlayRendered = true;
      this.updateState();
    });
    
    setInterval(() => this.updateState(), 1000);
  }

  createBadge() {
    this.badgeContainer = document.createElement("div");
    this.badgeContainer.id = "dual-subtitle-health-badge";
    this.badgeContainer.style.position = "fixed";
    this.badgeContainer.style.top = "20px";
    this.badgeContainer.style.right = "20px";
    this.badgeContainer.style.zIndex = "2147483647"; 
    this.badgeContainer.style.fontFamily = "system-ui, sans-serif";
    this.badgeContainer.style.cursor = "pointer";
    
    const shadow = this.badgeContainer.attachShadow({ mode: 'open' });
    
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .badge {
        display: inline-flex;
        align-items: center;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        backdrop-filter: blur(4px);
        transition: all 0.3s;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 8px;
      }
      .dot.live {
        background: #34c759;
        box-shadow: 0 0 8px #34c759;
        animation: pulse 2s infinite;
      }
      .dot.offline {
        background: #ff3b30;
      }
      @keyframes pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(52, 199, 89, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 199, 89, 0); }
      }
      .debug-panel {
        display: none;
        margin-top: 10px;
        background: rgba(0, 0, 0, 0.85);
        color: #00ff00;
        padding: 12px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 11px;
        width: 200px;
        white-space: pre-wrap;
      }
      .debug-panel.show {
        display: block;
      }
    `;
    shadow.appendChild(styleEl);
    
    this.badgeWrapper = document.createElement('div');
    this.badgeWrapper.className = 'badge';
    this.badgeWrapper.innerHTML = `
      <div class="dot offline" id="status-dot"></div>
      <span id="status-text">OFFLINE</span>
    `;
    shadow.appendChild(this.badgeWrapper);
    
    this.debugPanel = document.createElement('div');
    this.debugPanel.className = 'debug-panel';
    shadow.appendChild(this.debugPanel);
    
    this.badgeWrapper.addEventListener('click', () => {
      this.debugExpanded = !this.debugExpanded;
      if (this.debugExpanded) {
        this.debugPanel.classList.add('show');
      } else {
        this.debugPanel.classList.remove('show');
      }
      this.renderDebug();
    });
    
    document.body.appendChild(this.badgeContainer);
    
    this.statusDot = shadow.getElementById('status-dot');
    this.statusText = shadow.getElementById('status-text');
  }
  
  updateState() {
    const now = Date.now();
    const timeSinceLastSubtitle = now - this.state.lastSubtitleTimestamp;
    
    const isLive = 
      this.state.videoDetected && 
      this.state.subtitleDetected && 
      this.state.translationRunning && 
      (timeSinceLastSubtitle < 4000);
      
    // Broadcast state for popup
    try {
      chrome.runtime.sendMessage({ action: "healthState", isLive });
    } catch (e) {
      if (e.message.includes("Extension context invalidated")) {
        // Silently ignore context invalidation (happens on extension reload during dev)
      }
    }
    
    if (this.badgeContainer && this.badgeContainer.shadowRoot) {
      if (isLive) {
        this.statusDot.className = "dot live";
        this.statusText.textContent = "LIVE";
      } else {
        this.statusDot.className = "dot offline";
        this.statusText.textContent = "OFFLINE";
      }
      
      if (this.debugExpanded) {
        this.renderDebug();
      }
    }
  }
  
  renderDebug() {
    if (!this.debugPanel) return;
    this.debugPanel.innerHTML = `
Video: ${this.state.videoDetected ? 'YES' : 'NO'}
Subtitles: ${this.state.subtitleDetected ? 'YES' : 'NO'}
Translation: ${this.state.translationRunning ? 'YES' : 'NO'}
Overlay: ${this.state.overlayRendered ? 'YES' : 'NO'}
Last subtitle: ${this.state.lastSubtitleTimestamp ? ((Date.now() - this.state.lastSubtitleTimestamp)/1000).toFixed(1) + 's ago' : 'Never'}
    `.trim();
  }
}

window.healthMonitor = new HealthMonitor();"""

translator = """/**
 * Live Dual Subtitle Translator - Translation bridge
 */
class TranslationCoordinator {
  constructor() {
    this.settings = null;
    this.isTranslating = false;
    this.lastOriginalText = "";
    this.contextHistory = [];
    this.queue = [];
    this.debounceTimer = null;
    this.init();
  }

  async init() {
    await this.loadSettings();

    chrome.storage.onChanged.addListener(() => {
      this.loadSettings();
    });

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
        "translateOnly"
      ], (items) => {
        this.settings = items;
        resolve();
      });
    });
  }

  handleNewSubtitle(text) {
    if (!this.settings || !this.settings.isEnabled) return;
    if (!text || text === this.lastOriginalText) return;
    
    this.lastOriginalText = text;

    this.contextHistory.push(text);
    if (this.contextHistory.length > 4) {
      this.contextHistory.shift();
    }

    const context = this.contextHistory.slice(0, -1).join(" | ");
    
    // Debounce & Queue
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.processTranslation(text, context);
    }, 200);
  }
  
  processTranslation(text, context, attempt = 1) {
    window.subtitleLogger.log("Translator", `Requesting translation (Attempt ${attempt}):`, text);
    
    try {
      chrome.runtime.sendMessage({
        action: "translate",
        text: text,
        sourceLang: this.settings.sourceLang || "auto",
        targetLang: this.settings.targetLang || "en",
        context: context
      }, (response) => {
        if (chrome.runtime.lastError) {
          window.subtitleLogger.error("Translator", "Extension communication error:", chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success && response.translatedText) {
          window.subtitleLogger.log("Translator", "Translation success:", response.translatedText);
          window.dispatchEvent(new CustomEvent("subtitletranslated", {
            detail: {
              originalText: text,
              translatedText: response.translatedText,
              sourceLang: this.settings.sourceLang,
              targetLang: this.settings.targetLang
            }
          }));
        } else if (attempt < 3) {
          window.subtitleLogger.error("Translator", `Translation failed, retrying (${attempt+1}/3)...`);
          setTimeout(() => this.processTranslation(text, context, attempt + 1), 500);
        } else {
          window.subtitleLogger.error("Translator", "Max retries reached. Translation failed.");
        }
      });
    } catch (e) {
      if (e.message.includes("Extension context invalidated")) {
        console.warn("Translation aborted: Extension was reloaded. Please refresh the page.");
      }
    }
  }
}

window.translationCoordinator = new TranslationCoordinator();"""

overlay = """/**
 * Live Dual Subtitle Translator - Overlay UI
 */
class SubtitleOverlayManager {
  constructor() {
    this.overlayContainer = null;
    this.styleConfig = null;
    this.init();
  }

  async init() {
    await this.loadStyles();

    chrome.storage.onChanged.addListener(() => {
      this.loadStyles();
    });

    window.addEventListener("subtitletranslated", (e) => {
      this.renderSubtitle(e.detail.originalText, e.detail.translatedText);
    });

    document.addEventListener("fullscreenchange", () => this.handleFullscreenChange());
  }

  async loadStyles() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["style", "showOriginal", "translateOnly"], (result) => {
        this.styleConfig = result.style;
        this.showOriginal = result.showOriginal !== false;
        this.translateOnly = result.translateOnly || false;
        if (this.overlayContainer) {
          this.applyStyleConfig();
        }
        resolve();
      });
    });
  }

  createOverlayContainer() {
    const video = document.querySelector("video");
    if (!video) return null;

    const container = video.parentElement || document.body;
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
    
    let styleTag = shadowRoot.querySelector("style");
    if (!styleTag) {
      styleTag = document.createElement("style");
      shadowRoot.appendChild(styleTag);
    }

    const hex = style.bgColor || "#000000";
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    const bgOpacity = (style.bgOpacity !== undefined ? style.bgOpacity : 75) / 100;
    const rgbaBg = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;

    styleTag.textContent = `
      #overlay-box {
        position: absolute;
        width: ${style.width || 80}%;
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
        font-family: ${style.font || 'system-ui'}, sans-serif;
        font-size: ${style.fontSize || 22}px;
        font-weight: ${style.fontWeight || 'bold'};
        padding: 6px 14px;
        margin: 4px 0;
        border-radius: ${style.borderRadius || 8}px;
        background-color: ${rgbaBg};
        line-height: ${style.lineSpacing || 1.4};
        text-shadow: ${style.shadowEnabled ? '1px 1px 3px rgba(0,0,0,0.8), -1px -1px 3px rgba(0,0,0,0.8)' : 'none'};
        max-width: 90%;
        word-wrap: break-word;
        animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .translated-text {
        color: ${style.textColor || '#ffffff'};
        opacity: ${(style.translationOpacity || 100) / 100};
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
    `;

    const video = document.querySelector("video");
    const wrapper = document.querySelector("#dual-subtitle-overlay-root");
    
    if (video && wrapper) {
      const rect = video.getBoundingClientRect();
      wrapper.style.top = rect.top + window.scrollY + "px";
      wrapper.style.height = rect.height + "px";
      wrapper.style.width = rect.width + "px";
      wrapper.style.left = rect.left + window.scrollX + "px";

      const offset = style.offsetY || 0;
      if (style.position === "top") {
        this.overlayContainer.style.top = (20 + offset) + "px";
        this.overlayContainer.style.bottom = "auto";
      } else if (style.position === "middle") {
        this.overlayContainer.style.top = "50%";
        this.overlayContainer.style.transform = "translate(-50%, -50%)";
        this.overlayContainer.style.bottom = "auto";
      } else if (style.position === "above-original") {
        this.overlayContainer.style.bottom = (90 - offset) + "px";
        this.overlayContainer.style.top = "auto";
      } else { 
        this.overlayContainer.style.bottom = (30 + offset) + "px";
        this.overlayContainer.style.top = "auto";
      }
    }
  }

  renderSubtitle(original, translated) {
    const container = this.createOverlayContainer();
    if (!container) return;

    this.applyStyleConfig();
    container.innerHTML = "";

    const translatedEl = document.createElement("div");
    translatedEl.className = "caption-segment translated-text";
    translatedEl.innerText = translated;
    container.appendChild(translatedEl);

    if (this.showOriginal && !this.translateOnly) {
      const originalEl = document.createElement("div");
      originalEl.className = "caption-segment original-text";
      originalEl.innerText = original;
      container.appendChild(originalEl);
    }
  }

  handleFullscreenChange() {
    setTimeout(() => {
      this.applyStyleConfig();
    }, 500);
  }
}

window.subtitleOverlayManager = new SubtitleOverlayManager();"""

styles = """#dual-subtitle-overlay-root {
  pointer-events: none !important;
}"""

popup_html = """<!DOCTYPE html>
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
    .status-light {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #ff3b30;
      box-shadow: 0 0 6px #ff3b30;
      transition: all 0.3s;
    }
    .status-light.active {
      background-color: #34c759;
      box-shadow: 0 0 8px #34c759;
    }
    .btn-start {
      width: 100%;
      padding: 12px;
      margin-top: 10px;
      border-radius: 10px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      background-color: #34c759;
      color: white;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-start.stop {
      background-color: #ff3b30;
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
  <div class="header" style="flex-direction: column; align-items: stretch; gap: 4px;">
    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <div class="logo-container">
        <h2>Dual Subtitle API</h2>
      </div>
      <div class="status-light" id="status-light"></div>
    </div>
    <button class="btn-start" id="btn-start-stop">Start Translation</button>
    <div id="live-status-text" style="font-size: 11px; font-weight: bold; text-align: center; margin-top: 6px; color: #ff3b30;">🔴 OFFLINE — Waiting for subtitles</div>
  </div>

  <div class="section">
    <div class="section-title">Language Preferences</div>
    <div class="form-group">
      <label for="source-lang">Original Audio</label>
      <select id="source-lang">
        <option value="auto">Auto Detect</option>
        <option value="de">German</option>
        <option value="es">Spanish</option>
        <option value="fr">French</option>
        <option value="hi">Hindi</option>
        <option value="ja">Japanese</option>
      </select>
    </div>
    <div class="form-group">
      <label for="target-lang">Translate To</label>
      <select id="target-lang">
        <option value="en">English</option>
        <option value="es">Spanish</option>
        <option value="fr">French</option>
        <option value="hi">Hindi</option>
        <option value="de">German</option>
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
</html>"""

popup_js = """document.addEventListener("DOMContentLoaded", () => {
  const btnStartStop = document.getElementById("btn-start-stop");
  const statusLight = document.getElementById("status-light");
  const liveStatusText = document.getElementById("live-status-text");
  const sourceLang = document.getElementById("source-lang");
  const targetLang = document.getElementById("target-lang");
  const displayMode = document.getElementById("display-mode");
  const openSettings = document.getElementById("open-settings");
  const clearCache = document.getElementById("clear-cache");
  const providerStatus = document.getElementById("provider-status");

  function updateStateUI(isEnabled) {
    if (isEnabled) {
      statusLight.classList.add("active");
      btnStartStop.classList.add("stop");
      btnStartStop.innerText = "Stop Translation";
    } else {
      statusLight.classList.remove("active");
      btnStartStop.classList.remove("stop");
      btnStartStop.innerText = "Start Translation";
      liveStatusText.innerText = "🔴 OFFLINE — Waiting for subtitles";
      liveStatusText.style.color = "#ff3b30";
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "healthState") {
      if (request.isLive) {
        liveStatusText.innerText = "🟢 LIVE — Translating";
        liveStatusText.style.color = "#34c759";
      } else {
        liveStatusText.innerText = "🔴 OFFLINE — Waiting for subtitles";
        liveStatusText.style.color = "#ff3b30";
      }
    }
  });

  chrome.storage.local.get([
    "isEnabled",
    "sourceLang",
    "targetLang",
    "translateOnly",
    "apiProvider"
  ], (items) => {
    updateStateUI(items.isEnabled !== false);
    sourceLang.value = items.sourceLang || "auto";
    targetLang.value = items.targetLang || "en";
    displayMode.value = items.translateOnly ? "translate-only" : "dual";
    
    const engine = items.apiProvider || "google";
    providerStatus.innerText = `Engine: ${engine.toUpperCase()}`;
  });

  btnStartStop.addEventListener("click", () => {
    chrome.storage.local.get(["isEnabled"], (items) => {
      const newState = !(items.isEnabled !== false);
      chrome.storage.local.set({ isEnabled: newState });
      updateStateUI(newState);
    });
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

  openSettings.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  clearCache.addEventListener("click", () => {
    chrome.storage.local.set({ translationHistory: [] }, () => {
      alert("History cleared successfully.");
    });
  });
});"""

settings_html = """<!DOCTYPE html>
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

    <div class="card">
      <h2 class="card-title">Translation Service Engine</h2>
      <div class="grid">
        <div class="form-group">
          <label for="api-provider">Provider</label>
          <select id="api-provider">
            <option value="google">Google Translate API (No Key Required)</option>
            <option value="gemini">Gemini AI Model (Full-stack Proxy)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="api-key">Service API Key</label>
          <input type="password" id="api-key" placeholder="Enter API Key (Optional for proxy)">
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">Caption Style & Layout</h2>
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
</html>"""

settings_js = """document.addEventListener("DOMContentLoaded", () => {
  const providerSelect = document.getElementById("api-provider");
  const apiKeyInput = document.getElementById("api-key");
  const fontFamilySelect = document.getElementById("font-family");
  const fontSizeInput = document.getElementById("font-size");
  const textColorInput = document.getElementById("text-color");
  const bgOpacityInput = document.getElementById("bg-opacity");
  
  const prevTrans = document.getElementById("prev-trans");
  const btnSave = document.getElementById("btn-save-settings");
  const btnExport = document.getElementById("btn-export");

  chrome.storage.local.get(["apiProvider", "apiKey", "style"], (items) => {
    providerSelect.value = items.apiProvider || "google";
    apiKeyInput.value = items.apiKey || "";
    
    if (items.style) {
      fontFamilySelect.value = items.style.font || "SF Pro Text";
      fontSizeInput.value = items.style.fontSize || 22;
      textColorInput.value = items.style.textColor || "#ffffff";
      bgOpacityInput.value = items.style.bgOpacity || 75;
      updatePreview();
    }
  });

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
});"""

def escape_backticks(s):
    return s.replace("`", "\\`").replace("${", "\\${")

files = {
    "manifest.json": manifest,
    "background.js": background,
    "content/logger.js": logger,
    "content/site-profiles.js": site_profiles,
    "content/detector.js": detector,
    "content/subtitle-extractor.js": extractor,
    "content/health-monitor.js": health_monitor,
    "content/translator.js": translator,
    "content/overlay.js": overlay,
    "content/styles.css": styles,
    "popup/popup.html": popup_html,
    "popup/popup.js": popup_js,
    "options/settings.html": settings_html,
    "options/settings.js": settings_js,
}

js_content = 'import fs from "fs";\nimport path from "path";\n\nconst extensionSources = {\n'
for k, v in files.items():
    js_content += '  "%s": `%s`,\n\n' % (k, escape_backticks(v))

js_content += """};

// Build directories and write files
function writeExtensionFiles() {
  const distDir = path.join(process.cwd(), "dist");
  
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Create standard folder layout inside dist/ for the unpacking experience
  const contentDir = path.join(distDir, "content");
  const popupDir = path.join(distDir, "popup");
  const optionsDir = path.join(distDir, "options");

  if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir);
  if (!fs.existsSync(popupDir)) fs.mkdirSync(popupDir);
  if (!fs.existsSync(optionsDir)) fs.mkdirSync(optionsDir);

  Object.entries(extensionSources).forEach(([relPath, content]) => {
    const fullPath = path.join(distDir, relPath);
    console.log(`Writing extension file to output directory: ${fullPath}`);
    fs.writeFileSync(fullPath, content, "utf8");
  });

  console.log("All Manifest V3 Extension files written to dist/ successfully!");
}

writeExtensionFiles();
"""

with open('copy-extension.js', 'w') as f:
    f.write(js_content)
