import fs from "fs";
import path from "path";

const extensionSources = {
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
}`,

  "background.js": `/**
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
    const cacheKey = \`\${sourceLang}_\${targetLang}_\${text}\`;
    
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
          } catch (geminiErr) {
            console.warn("Gemini API failed, falling back to Google Translate. Error:", geminiErr);
            const url = \`https://translate.googleapis.com/translate_a/single?client=gtx&sl=\${sourceLang === 'auto' ? 'auto' : sourceLang}&tl=\${targetLang}&dt=t&q=\${encodeURIComponent(text)}\`;
            const res = await fetch(url);
            const data = await res.json();
            translatedText = data[0].map(x => x[0]).join("");
          }
        } else if (provider === "google") {
          const url = \`https://translate.googleapis.com/translate_a/single?client=gtx&sl=\${sourceLang === 'auto' ? 'auto' : sourceLang}&tl=\${targetLang}&dt=t&q=\${encodeURIComponent(text)}\`;
          const res = await fetch(url);
          const data = await res.json();
          translatedText = data[0].map(x => x[0]).join("");
        } else {
          translatedText = \`[\${targetLang.toUpperCase()}] \${text}\`;
        }

        translationCache.set(cacheKey, translatedText);
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
}`,

  "content/logger.js": `/**
 * Live Dual Subtitle Translator - Debug Logger
 */
class SubtitleLogger {
  log(prefix, ...args) {
    if (window.__subtitleDebug) {
      console.log(\`%c[\${prefix}]\`, 'color: #34c759; font-weight: bold;', ...args);
    }
  }
  error(prefix, ...args) {
    if (window.__subtitleDebug) {
      console.error(\`%c[\${prefix}]\`, 'color: #ff3b30; font-weight: bold;', ...args);
    }
  }
}
window.subtitleLogger = new SubtitleLogger();`,

  "content/site-profiles.js": `/**
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
};`,

  "content/detector.js": `/**
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

window.videoDetector = new UniversalVideoDetector();`,

  "content/subtitle-extractor.js": `/**
 * Live Dual Subtitle Translator - Subtitle Extraction Engine
 *
 * Finds the subtitle that is actually visible on screen (NOT player-UI text),
 * measures its rendered geometry, and emits it for translation. Also detects
 * when the subtitle disappears so the translation can be cleared in sync.
 *
 * Detection priority:
 *   1. <video>.textTracks active cues (most reliable, no DOM element)
 *   2. Site-profile selectors -> the visible caption element (excludes controls)
 *   3. MutationObserver catch-all (heavily filtered) as a last resort
 *
 * Events dispatched:
 *   - "subtitleextracted" { text, rect, lineHeight }
 *   - "subtitlecleared"   (subtitle left the screen)
 */

// Text that is part of the player chrome, never a real subtitle.
const UI_IGNORE_LIST = [
  "play", "pause", "mute", "unmute", "settings", "fullscreen", "exit fullscreen",
  "episodes", "download", "theater", "add", "watch", "more", "subtitle", "subtitles",
  "closed caption", "closed captions", "cc", "subscribe", "subscribed",
  "precise seeking", "seek", "live", "autoplay", "auto", "next", "next episode",
  "previous", "quality", "speed", "captions", "share", "like", "dislike",
  "picture in picture", "skip", "skip intro", "replay", "loading", "buffering"
];

// Ancestor class/id patterns that mark a player control container (NOT a caption).
// Deliberately avoids "caption"/"subtitle"/"track" which are real subtitle markers.
const CONTROL_PATTERN = /(control|button|btn|menu|tooltip|setting|seekbar|scrubber|progress|toolbar|controlbar|control-bar|overlay-ui|player-ui|ytp-(?!caption)|vjs-control|jw-controls|jw-icon|plyr__control)/i;

const OWN_IDS = ["dual-subtitle-overlay-root", "dual-subtitle-health-badge"];

class SubtitleExtractor {
  constructor() {
    this.observer = null;
    this.pollTimer = null;
    this.watchRaf = null;
    this.profile = window.siteProfiles.getProfile(window.location.hostname);
    this.lastSubtitleText = "";
    this.lastSubtitleEl = null;   // tracked DOM element (null for textTrack cues)
    this.isActive = false;
    this.init();
  }

  init() {
    window.subtitleLogger.log("Extractor", "Init with profile:", this.profile.id);

    window.addEventListener("videoattached", (e) => this.bindNativeTracks(e.detail.video));
    const existing = document.querySelector("video");
    if (existing) this.bindNativeTracks(existing);

    this.startObserver();
    this.startWatcher();
    this.pollTimer = setInterval(() => this.extractFromDOM(), 800);
  }

  // ── Native textTracks ─────────────────────────────────────
  bindNativeTracks(video) {
    if (!video || !video.textTracks) return;

    const bind = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if (track._dstBound) continue;
        track._dstBound = true;
        track.addEventListener("cuechange", () => this.extractFromActiveCues(track));
      }
    };
    bind();
    video.addEventListener("loadedmetadata", bind);
    video.textTracks.addEventListener("addtrack", bind);
  }

  extractFromActiveCues(track) {
    let text = "";
    if (track.activeCues && track.activeCues.length > 0) {
      for (let j = 0; j < track.activeCues.length; j++) {
        text += track.activeCues[j].text + " ";
      }
    }
    text = this.normalize(text);
    if (text) {
      this.emit(text, null); // native cues expose no usable DOM element
    } else {
      this.clear();
    }
  }

  // ── DOM extraction (profile selectors) ────────────────────
  extractFromDOM() {
    // textTracks first (in case cuechange was missed)
    const videos = document.querySelectorAll("video");
    for (const v of videos) {
      if (!v.textTracks) continue;
      for (let i = 0; i < v.textTracks.length; i++) {
        const track = v.textTracks[i];
        if (track.mode === "showing" || track.mode === "hidden") {
          if (track.activeCues && track.activeCues.length > 0) {
            let text = "";
            for (let j = 0; j < track.activeCues.length; j++) {
              text += track.activeCues[j].text + " ";
            }
            text = this.normalize(text);
            if (text) { this.emit(text, null); return; }
          }
        }
      }
    }

    const el = this.findSubtitleElement(document);
    if (el) {
      const text = this.normalize(el.textContent);
      if (this.isSubtitleText(text)) this.emit(text, el);
    }
  }

  /** Find the visible caption element via profile selectors, skipping controls. */
  findSubtitleElement(root) {
    for (const sel of this.profile.selectors) {
      let els;
      try { els = root.querySelectorAll(sel); } catch (e) { continue; }
      for (const el of els) {
        if (this.isViableCaption(el)) return el;
      }
    }
    // Traverse shadow roots (some players render captions inside shadow DOM)
    try {
      for (const el of root.querySelectorAll("*")) {
        if (el.shadowRoot) {
          const found = this.findSubtitleElement(el.shadowRoot);
          if (found) return found;
        }
      }
    } catch (e) {}
    return null;
  }

  isViableCaption(el) {
    if (!el || this.isOwnNode(el) || this.isInControl(el)) return false;
    const text = this.normalize(el.textContent);
    if (!this.isSubtitleText(text)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;            // not rendered
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.opacity === "0") return false;
    return true;
  }

  // ── MutationObserver fallback ─────────────────────────────
  startObserver() {
    if (this.observer) this.observer.disconnect();
    if (!document.body) {
      setTimeout(() => this.startObserver(), 300);
      return;
    }
    this.observer = new MutationObserver((mutations) => {
      let bestEl = null;
      let bestText = "";
      for (const m of mutations) {
        const node = m.type === "characterData" ? m.target.parentElement : m.target;
        const el = node && node.nodeType === Node.ELEMENT_NODE ? node : (node && node.parentElement);
        if (!el || this.isOwnNode(el) || this.isInControl(el)) continue;
        const text = this.normalize(el.textContent);
        if (this.isSubtitleText(text) && text.length > bestText.length) {
          bestText = text;
          bestEl = el;
        }
      }
      if (bestEl) this.emit(bestText, bestEl);
    });
    this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // ── Disappearance watcher (sync clearing) ─────────────────
  startWatcher() {
    const loop = () => {
      if (this.isActive && this.lastSubtitleEl) {
        if (!document.contains(this.lastSubtitleEl)) {
          this.clear();
        } else {
          const text = this.normalize(this.lastSubtitleEl.textContent);
          const rect = this.lastSubtitleEl.getBoundingClientRect();
          const visible = rect.width > 1 && rect.height > 1 &&
            window.getComputedStyle(this.lastSubtitleEl).opacity !== "0";
          if (!text || !visible) this.clear();
        }
      }
      this.watchRaf = requestAnimationFrame(loop);
    };
    this.watchRaf = requestAnimationFrame(loop);
  }

  // ── Emit / clear ──────────────────────────────────────────
  emit(text, el) {
    if (!text || text === this.lastSubtitleText) {
      this.lastSubtitleEl = el || this.lastSubtitleEl; // keep geometry fresh
      return;
    }
    this.lastSubtitleText = text;
    this.lastSubtitleEl = el;
    this.isActive = true;

    let rect = null;
    let lineHeight = null;
    if (el) {
      rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 30;
    }

    window.subtitleLogger.log("Extractor", "Extracted:", text);
    window.dispatchEvent(new CustomEvent("subtitleextracted", {
      detail: { text, rect, lineHeight }
    }));
  }

  clear() {
    if (!this.isActive) return;
    this.isActive = false;
    this.lastSubtitleText = "";
    this.lastSubtitleEl = null;
    window.subtitleLogger.log("Extractor", "Subtitle cleared");
    window.dispatchEvent(new CustomEvent("subtitlecleared"));
  }

  // ── Helpers ───────────────────────────────────────────────
  normalize(text) {
    return (text || "").replace(/\\s+/g, " ").trim();
  }

  /** Heuristic: is this real subtitle text rather than UI chrome? */
  isSubtitleText(text) {
    if (!text || text.length < 2 || text.length > 200) return false;
    if (text.split(" ").length > 30) return false;            // static page text
    const hasLetter = /[a-zA-ZÀ-ɏЀ-ӿ぀-ヿ一-龥ऀ-ॿ가-힯]/.test(text);
    if (!hasLetter) return false;
    if (/^\\s*\\d{1,2}:\\d{2}/.test(text)) return false;          // timecodes like 1:34:06
    if (UI_IGNORE_LIST.includes(text.toLowerCase())) return false;
    return true;
  }

  isOwnNode(el) {
    return !!(el.closest && OWN_IDS.some((id) => el.closest("#" + id)));
  }

  isInControl(el) {
    let node = el;
    let depth = 0;
    while (node && node.nodeType === Node.ELEMENT_NODE && depth < 8) {
      if (node.getAttribute) {
        if (node.getAttribute("role") === "button") return true;
        if (node.getAttribute("aria-hidden") === "true") return true;
      }
      const id = (node.id || "") + " " + (node.className && node.className.baseVal !== undefined
        ? node.className.baseVal : node.className || "");
      if (CONTROL_PATTERN.test(id)) return true;
      node = node.parentElement || (node.getRootNode && node.getRootNode().host);
      depth++;
    }
    return false;
  }
}

window.subtitleExtractor = new SubtitleExtractor();
`,

  "content/health-monitor.js": `/**
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
    this.enabled = true; // mirror of chrome.storage.local.isEnabled
    this.init();
  }

  init() {
    this.createBadge();

    // Reflect the authoritative enabled state (OFFLINE the moment user stops).
    try {
      chrome.storage.local.get(["isEnabled"], (items) => {
        if (!chrome.runtime.lastError) this.enabled = items.isEnabled !== false;
        this.updateState();
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes.isEnabled) return;
        this.enabled = changes.isEnabled.newValue !== false;
        if (!this.enabled) {
          // Reset live signals so the badge drops to OFFLINE instantly.
          this.state.translationRunning = false;
          this.state.overlayRendered = false;
          this.state.subtitleDetected = false;
        }
        this.updateState();
      });
    } catch (e) {}

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
      if (!this.enabled) return;
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
    styleEl.textContent = \`
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
    \`;
    shadow.appendChild(styleEl);
    
    this.badgeWrapper = document.createElement('div');
    this.badgeWrapper.className = 'badge';
    this.badgeWrapper.innerHTML = \`
      <div class="dot offline" id="status-dot"></div>
      <span id="status-text">OFFLINE</span>
    \`;
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
      this.enabled &&                       // user toggle is authoritative
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
    this.debugPanel.innerHTML = \`
Video: \${this.state.videoDetected ? 'YES' : 'NO'}
Subtitles: \${this.state.subtitleDetected ? 'YES' : 'NO'}
Translation: \${this.state.translationRunning ? 'YES' : 'NO'}
Overlay: \${this.state.overlayRendered ? 'YES' : 'NO'}
Last subtitle: \${this.state.lastSubtitleTimestamp ? ((Date.now() - this.state.lastSubtitleTimestamp)/1000).toFixed(1) + 's ago' : 'Never'}
    \`.trim();
  }
}

window.healthMonitor = new HealthMonitor();`,

  "content/translator.js": `/**
 * Live Dual Subtitle Translator - Translation bridge
 *
 * The single authority for whether translation runs. Source of truth is
 * chrome.storage.local.isEnabled (written ONLY by the user via the popup, and
 * the install default in background.js). Detection (extractor) is fully
 * decoupled: it keeps observing subtitles, but NOTHING is translated or
 * rendered unless \`enabled === true\`. "Stop Translation" is authoritative and
 * never auto-overridden by subtitle detection, SPA navigation, fullscreen,
 * reconnects, or in-flight requests.
 */
class TranslationCoordinator {
  constructor() {
    this.settings = null;
    this.enabled = null;          // null = not yet restored from storage
    this.epoch = 0;               // bumped on disable to drop in-flight responses
    this.lastOriginalText = "";
    this.contextHistory = [];
    this.debounceTimer = null;
    this.retryTimers = [];
    this.contextDead = false;
    this.lastIgnoreLog = 0;
    this.init();
  }

  init() {
    // Register listeners synchronously so no event is missed while settings
    // load, and so the state gate is active immediately.

    // Single source of truth: react to storage changes (this is also how the
    // popup "broadcasts" the toggle to every tab/frame).
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area && area !== "local") return;
      this.loadSettings();
    });

    window.addEventListener("subtitleextracted", (e) => {
      this.handleNewSubtitle(e.detail.text, e.detail.rect, e.detail.lineHeight);
    });

    // Reset dedupe so the same line shown again (after a gap) re-translates.
    window.addEventListener("subtitlecleared", () => {
      this.lastOriginalText = "";
    });

    this.loadSettings();
  }

  isContextValid() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  handleContextDead() {
    if (this.contextDead) return;
    this.contextDead = true;
    this.cancelPending();
    window.subtitleLogger.log("Translator", "Extension was reloaded — refresh the page to resume translating.");
  }

  async loadSettings() {
    if (!this.isContextValid()) return;
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([
          "isEnabled",
          "sourceLang",
          "targetLang",
          "showOriginal",
          "translateOnly"
        ], (items) => {
          if (chrome.runtime.lastError) { resolve(); return; }
          this.settings = items;
          this.setEnabled(items.isEnabled !== false);
          resolve();
        });
      } catch (e) {
        this.handleContextDead();
        resolve();
      }
    });
  }

  /** Apply an authoritative enabled state, running transition side-effects. */
  setEnabled(on) {
    const prev = this.enabled;
    if (prev === on) return;
    this.enabled = on;

    if (prev === null) return;       // initial restore from storage: no side-effects

    if (on) {
      window.subtitleLogger.log("Translation Enabled");
    } else {
      // STOP: fully halt the pipeline and wipe what's on screen.
      this.cancelPending();
      window.subtitleLogger.log("Translation Disabled");
      window.dispatchEvent(new CustomEvent("subtitlecleared")); // overlay clears
    }
  }

  /** Cancel debounce, retries, and invalidate any in-flight responses. */
  cancelPending() {
    this.epoch++;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    this.retryTimers.forEach((t) => clearTimeout(t));
    this.retryTimers = [];
    this.lastOriginalText = "";
    this.contextHistory = [];
  }

  handleNewSubtitle(text, rect, lineHeight) {
    if (this.contextDead || !this.isContextValid()) return;

    // User intent is highest priority — detection NEVER auto-restarts translation.
    if (!this.enabled) {
      const now = Date.now();
      if (now - this.lastIgnoreLog > 2000) {
        this.lastIgnoreLog = now;
        window.subtitleLogger.log("Translation Ignored — User Disabled");
      }
      return;
    }

    if (!this.settings) return;
    if (!text || text === this.lastOriginalText) return;

    this.lastOriginalText = text;

    this.contextHistory.push(text);
    if (this.contextHistory.length > 4) {
      this.contextHistory.shift();
    }

    const context = this.contextHistory.slice(0, -1).join(" | ");

    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.processTranslation(text, context, rect, lineHeight);
    }, 200);
  }

  processTranslation(text, context, rect, lineHeight, attempt = 1) {
    // Re-check at every stage so a queued/retried call can't slip through after Stop.
    if (!this.enabled || this.contextDead || !this.isContextValid()) {
      if (!this.isContextValid()) this.handleContextDead();
      return;
    }
    const epoch = this.epoch;
    window.subtitleLogger.log("Translator", \`Requesting translation (Attempt \${attempt}):\`, text);

    try {
      chrome.runtime.sendMessage({
        action: "translate",
        text: text,
        sourceLang: this.settings.sourceLang || "auto",
        targetLang: this.settings.targetLang || "en",
        context: context
      }, (response) => {
        // Drop the response if translation was disabled (or superseded) meanwhile.
        if (epoch !== this.epoch || !this.enabled) return;

        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || "";
          if (msg.includes("context invalidated")) { this.handleContextDead(); return; }
          window.subtitleLogger.error("Translator", "Extension communication error:", msg);
          return;
        }

        if (response && response.success && response.translatedText) {
          window.subtitleLogger.log("Translator", "Translation success:", response.translatedText);
          window.dispatchEvent(new CustomEvent("subtitletranslated", {
            detail: {
              originalText: text,
              translatedText: response.translatedText,
              sourceLang: this.settings.sourceLang,
              targetLang: this.settings.targetLang,
              rect,
              lineHeight
            }
          }));
        } else if (attempt < 3) {
          const t = setTimeout(() => this.processTranslation(text, context, rect, lineHeight, attempt + 1), 500);
          this.retryTimers.push(t);
        } else {
          window.subtitleLogger.error("Translator", "Max retries reached. Translation failed.");
        }
      });
    } catch (e) {
      if (e.message && e.message.includes("context invalidated")) {
        this.handleContextDead();
      } else {
        window.subtitleLogger.error("Translator", "Unexpected error:", e);
      }
    }
  }
}

window.translationCoordinator = new TranslationCoordinator();
`,

  "content/overlay.js": `/**
 * Live Dual Subtitle Translator - Overlay UI
 *
 * Renders the translation in an isolated Shadow-DOM overlay over the video and
 * keeps it glued to the live subtitle using a requestAnimationFrame tracker.
 *
 * Modes (style.position):
 *   - "side-by-side": translation locked to the RIGHT of the native subtitle,
 *     vertically aligned to its top. It NEVER auto-switches to another mode —
 *     if horizontal room is tight it pins a column at the video's right edge and
 *     wraps; if there is no caption element (native textTrack) it uses a stable
 *     bottom-right anchor. Renders the translation ONLY (the player's caption is
 *     the original).
 *   - "above-original" / "top" / "middle" / "bottom": fixed placements.
 *
 * Sync: a rAF loop tracks window.subtitleExtractor.lastSubtitleEl, repositions
 * the overlay every few frames, and clears it the instant the caption is gone
 * (also wired to the "subtitlecleared" event). Styles are only written when they
 * change, so there is no flicker or layout thrashing.
 */

const GAP = 16;             // px between the original subtitle and the translation
const MIN_SIDE_WIDTH = 120; // px minimum width before we pin a right-edge column

class SubtitleOverlayManager {
  constructor() {
    this.overlayContainer = null;
    this.styleConfig = null;
    this.enabled = true;        // mirror of chrome.storage.local.isEnabled
    this.showOriginal = true;
    this.translateOnly = false;
    this.lastRect = null;
    this.lastLineHeight = null;
    this.renderedKey = null;
    this.lastBoxKey = null;
    this.showing = false;
    this.posRaf = null;
    this.frame = 0;
    this.staleTimer = null;
    this.init();
  }

  async init() {
    await this.loadStyles();

    chrome.storage.onChanged.addListener(() => this.loadStyles());

    window.addEventListener("subtitletranslated", (e) => {
      this.renderSubtitle(
        e.detail.originalText,
        e.detail.translatedText,
        e.detail.rect,
        e.detail.lineHeight
      );
    });

    window.addEventListener("subtitlecleared", () => this.clearOverlay());

    document.addEventListener("fullscreenchange", () => this.handleFullscreenChange());
    document.addEventListener("webkitfullscreenchange", () => this.handleFullscreenChange());
  }

  async loadStyles() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["style", "showOriginal", "translateOnly", "isEnabled"], (result) => {
          if (chrome.runtime.lastError) { resolve(); return; }
          this.styleConfig = result.style;
          this.showOriginal = result.showOriginal !== false;
          this.translateOnly = result.translateOnly || false;
          this.enabled = result.isEnabled !== false;
          // If the user disabled translation, wipe anything on screen immediately.
          if (!this.enabled) {
            this.clearOverlay();
          } else {
            // Force a reposition next frame (mode may have changed).
            this.lastBoxKey = null;
            if (this.overlayContainer) this.applyStyleConfig();
          }
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }

  createOverlayContainer() {
    const video = document.querySelector("video");
    if (!video) return null;

    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    const container = fsEl || video.parentElement || document.body;
    if (window.getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    let wrapper = document.getElementById("dual-subtitle-overlay-root");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "dual-subtitle-overlay-root";
      wrapper.style.position = "absolute";
      wrapper.style.zIndex = "999999";
      wrapper.style.pointerEvents = "none";
      wrapper.style.overflow = "hidden";
      container.appendChild(wrapper);

      const shadow = wrapper.attachShadow({ mode: "open" });
      const inner = document.createElement("div");
      inner.id = "overlay-box";
      shadow.appendChild(inner);
      this.overlayContainer = inner;
    } else if (wrapper.parentElement !== container) {
      container.appendChild(wrapper); // reparent on fullscreen change
      this.overlayContainer = wrapper.shadowRoot.getElementById("overlay-box");
    } else if (!this.overlayContainer) {
      this.overlayContainer = wrapper.shadowRoot.getElementById("overlay-box");
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
    const rgbaBg = \`rgba(\${r}, \${g}, \${b}, \${bgOpacity})\`;

    styleTag.textContent = \`
      #overlay-box {
        position: absolute;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        z-index: 10000;
      }
      .caption-segment {
        font-family: \${style.font || "system-ui"}, sans-serif;
        font-size: \${style.fontSize || 22}px;
        font-weight: \${style.fontWeight || "bold"};
        padding: 6px 14px;
        margin: 4px 0;
        border-radius: \${style.borderRadius || 8}px;
        background-color: \${rgbaBg};
        line-height: \${style.lineSpacing || 1.4};
        text-shadow: \${style.shadowEnabled ? "1px 1px 3px rgba(0,0,0,0.8), -1px -1px 3px rgba(0,0,0,0.8)" : "none"};
        word-wrap: break-word;
        animation: fadeIn 0.18s ease;
      }
      .translated-text {
        color: \${style.textColor || "#ffffff"};
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
        to   { opacity: 1; transform: translateY(0); }
      }
    \`;

    this.positionOverlay();
  }

  // ── Live tracker ──────────────────────────────────────────
  startPositionLoop() {
    if (this.posRaf) return;
    const loop = () => {
      if (!this.showing) { this.posRaf = null; return; }
      this.frame++;
      if (this.frame % 3 === 0) this.trackAndPosition(); // ~50ms cadence, < 100ms sync
      this.posRaf = requestAnimationFrame(loop);
    };
    this.posRaf = requestAnimationFrame(loop);
  }

  stopPositionLoop() {
    if (this.posRaf) cancelAnimationFrame(this.posRaf);
    this.posRaf = null;
  }

  trackAndPosition() {
    const ex = window.subtitleExtractor;
    // Clear in sync the moment the original subtitle leaves the screen.
    if (ex && ex.isActive === false) { this.clearOverlay(); return; }
    // Live-measure the actual caption element so we never use a stale snapshot.
    if (ex && ex.lastSubtitleEl && document.contains(ex.lastSubtitleEl)) {
      const r = ex.lastSubtitleEl.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) this.lastRect = r;
    }
    this.resetStaleTimer(); // keep alive while the loop runs
    this.positionOverlay();
  }

  // ── Positioning ───────────────────────────────────────────
  positionOverlay() {
    const video = document.querySelector("video");
    const wrapper = document.getElementById("dual-subtitle-overlay-root");
    if (!video || !wrapper || !this.overlayContainer) return;

    const v = video.getBoundingClientRect();
    wrapper.style.top = v.top + window.scrollY + "px";
    wrapper.style.left = v.left + window.scrollX + "px";
    wrapper.style.width = v.width + "px";
    wrapper.style.height = v.height + "px";

    const style = this.styleConfig || {};
    const offset = style.offsetY || 0;
    const rect = this.lastRect;
    const mode = style.position || "above-original";

    const s = {
      top: "auto", bottom: "auto", left: "50%", right: "auto",
      transform: "translateX(-50%)", maxWidth: "90%",
      width: mode === "side-by-side" ? "auto" : (style.width || 80) + "%",
      alignItems: "center",
    };

    if (mode === "side-by-side") {
      this.computeSideBySide(s, v, rect, offset);
    } else if (mode === "top") {
      s.top = (20 + offset) + "px";
    } else if (mode === "middle") {
      s.top = "50%";
      s.transform = "translate(-50%, -50%)";
    } else if (mode === "above-original" && rect && rect.height > 1) {
      this.computeAbove(s, v, rect, offset);
    } else if (mode === "above-original") {
      s.bottom = (90 - offset) + "px";
    } else {
      s.bottom = (30 + offset) + "px";
    }

    this.applyBoxStyles(s);
  }

  /** Side-by-side: ALWAYS to the right — no mode flipping. */
  computeSideBySide(s, v, rect, offset) {
    s.alignItems = "flex-start";
    s.transform = "none";
    s.width = "auto";

    if (rect && rect.width > 1) {
      let left = (rect.right - v.left) + GAP;
      let maxW = v.width - left - 8;
      if (maxW < MIN_SIDE_WIDTH) {
        // Caption hugs the right edge: pin a column to the video's right side
        // (still beside the caption row, never above/below it).
        maxW = Math.min(Math.max(MIN_SIDE_WIDTH, Math.round(v.width * 0.33)), v.width - 16);
        left = v.width - maxW - 8;
        if (left < 8) left = 8;
      }
      s.left = Math.round(left) + "px";
      s.top = Math.max(0, Math.round((rect.top - v.top) - offset)) + "px";
      s.maxWidth = Math.floor(maxW) + "px";
    } else {
      // No caption element (native textTrack): stable bottom-right anchor.
      const panel = Math.min(Math.max(MIN_SIDE_WIDTH, Math.round(v.width * 0.33)), v.width - 16);
      s.left = (v.width - panel - 8) + "px";
      s.bottom = (30 + offset) + "px";
      s.maxWidth = Math.floor(panel) + "px";
    }
  }

  /** Centered just above the subtitle's top edge. */
  computeAbove(s, v, rect, offset) {
    let bottom = (v.bottom - rect.top) + GAP - offset;
    const maxBottom = v.height - 10;
    if (bottom < 10) bottom = 10;
    if (bottom > maxBottom) bottom = maxBottom;
    s.bottom = Math.round(bottom) + "px";
    s.left = Math.round((rect.left - v.left) + rect.width / 2) + "px";
    s.transform = "translateX(-50%)";
    s.width = "auto";
    s.maxWidth = "90%";
  }

  /** Write styles only when they actually change (no flicker / no thrash). */
  applyBoxStyles(s) {
    const key = \`\${s.top}|\${s.bottom}|\${s.left}|\${s.right}|\${s.transform}|\${s.maxWidth}|\${s.width}|\${s.alignItems}\`;
    if (key === this.lastBoxKey) return;
    this.lastBoxKey = key;
    const box = this.overlayContainer;
    box.style.top = s.top;
    box.style.bottom = s.bottom;
    box.style.left = s.left;
    box.style.right = s.right;
    box.style.transform = s.transform;
    box.style.maxWidth = s.maxWidth;
    box.style.width = s.width;
    box.style.alignItems = s.alignItems;
  }

  // ── Render / clear ────────────────────────────────────────
  renderSubtitle(original, translated, rect, lineHeight) {
    if (!translated) return;
    // Authoritative gate: never render / create overlay while disabled.
    if (!this.enabled) return;
    const container = this.createOverlayContainer();
    if (!container) return;

    if (rect) { this.lastRect = rect; this.lastLineHeight = lineHeight; }

    const style = this.styleConfig || {};
    const hasRect = !!(this.lastRect && this.lastRect.width > 1 && this.lastRect.height > 1);
    // In side-by-side the player's own caption IS the original — never duplicate it.
    const sideBySide = style.position === "side-by-side" && hasRect;
    const renderOriginal = this.showOriginal && !this.translateOnly && !sideBySide;

    // Rebuild (and re-animate) only when the text/mode changed.
    const key = \`\${style.position}|\${translated}|\${renderOriginal ? original : ""}\`;
    if (key !== this.renderedKey) {
      this.renderedKey = key;
      this.lastBoxKey = null; // content changed -> recompute position
      container.innerHTML = "";

      const translatedEl = document.createElement("div");
      translatedEl.className = "caption-segment translated-text";
      translatedEl.textContent = translated;
      container.appendChild(translatedEl);

      if (renderOriginal) {
        const originalEl = document.createElement("div");
        originalEl.className = "caption-segment original-text";
        originalEl.textContent = original;
        container.appendChild(originalEl);
      }
    }

    this.showing = true;
    this.applyStyleConfig();
    this.resetStaleTimer();
    this.startPositionLoop();
  }

  resetStaleTimer() {
    clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.clearOverlay(), 3000);
  }

  clearOverlay() {
    const hadContent = this.renderedKey !== null;
    this.showing = false;
    this.stopPositionLoop();
    clearTimeout(this.staleTimer);
    this.staleTimer = null;
    if (this.overlayContainer) this.overlayContainer.innerHTML = "";
    this.renderedKey = null;
    this.lastBoxKey = null;
    this.lastRect = null;
    this.lastLineHeight = null;
    if (hadContent) window.subtitleLogger.log("Overlay Cleared");
  }

  handleFullscreenChange() {
    setTimeout(() => {
      this.lastBoxKey = null;
      this.createOverlayContainer();
      this.applyStyleConfig();
    }, 300);
  }
}

window.subtitleOverlayManager = new SubtitleOverlayManager();
`,

  "content/styles.css": `#dual-subtitle-overlay-root {
  pointer-events: none !important;
}`,

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
</html>`,

  "popup/popup.js": `document.addEventListener("DOMContentLoaded", () => {
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
    providerStatus.innerText = \`Engine: \${engine.toUpperCase()}\`;
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
});`,

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
        <div class="form-group">
          <label for="display-position">Translation Position</label>
          <select id="display-position">
            <option value="above-original">Above Original</option>
            <option value="side-by-side">Side-by-Side (right of original)</option>
            <option value="top">Top</option>
            <option value="middle">Middle</option>
            <option value="bottom">Bottom</option>
          </select>
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

  "options/settings.js": `document.addEventListener("DOMContentLoaded", () => {
  const providerSelect = document.getElementById("api-provider");
  const apiKeyInput = document.getElementById("api-key");
  const fontFamilySelect = document.getElementById("font-family");
  const fontSizeInput = document.getElementById("font-size");
  const textColorInput = document.getElementById("text-color");
  const bgOpacityInput = document.getElementById("bg-opacity");
  const positionSelect = document.getElementById("display-position");

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
      positionSelect.value = items.style.position || "above-original";
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
        bgOpacity: parseInt(bgOpacityInput.value),
        position: positionSelect.value
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
});`,

};

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
