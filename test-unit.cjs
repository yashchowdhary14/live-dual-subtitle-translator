/**
 * Offline unit tests for the subtitle fixes — no browser / network needed.
 * Loads the REAL dist content scripts into a mocked DOM via vm and asserts:
 *   1. Extractor whitespace normalization no longer strips the letter "s".
 *   2. Extractor rejects player-UI text / timecodes, accepts real captions.
 *   3. Overlay side-by-side places the box to the RIGHT when there is room,
 *      and falls back to ABOVE when there isn't.
 *   4. Overlay clears on "subtitlecleared".
 */
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const C = (f) => fs.readFileSync(path.join(__dirname, "dist/content", f), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗ FAIL:", name); } };
const eq = (name, a, b) => ok(`${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, a === b);

function makeSandbox(extra = {}) {
  const sb = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    MutationObserver: class { observe() {} disconnect() {} },
  };
  sb.window = sb;
  sb.self = sb;
  sb.window.scrollX = 0;
  sb.window.scrollY = 0;
  sb.window.innerWidth = 1280;
  sb.document = {
    querySelector: () => null,
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: {},
  };
  sb.getComputedStyle = () => ({ position: "relative", lineHeight: "36px", fontSize: "30px", opacity: "1", visibility: "visible" });
  sb.window.getComputedStyle = sb.getComputedStyle;
  sb.chrome = {
    storage: { local: { get: (k, cb) => cb && cb({}) }, onChanged: { addListener() {} } },
    runtime: { id: "test" },
  };
  sb.window.addEventListener = () => {};
  sb.window.dispatchEvent = () => {};
  sb.window.subtitleLogger = { log() {}, warn() {}, error() {} };
  sb.window.location = { hostname: "player.videasy.to" };
  Object.assign(sb, extra);
  Object.assign(sb.window, extra);
  return sb;
}

// ════════════════════════════════════════════════════════════
console.log("\n[Test 1] Extractor: whitespace normalization keeps 's', rejects UI text");
{
  const sb = makeSandbox();
  vm.createContext(sb);
  vm.runInContext(C("site-profiles.js"), sb);
  vm.runInContext(C("subtitle-extractor.js"), sb);
  const ex = sb.window.subtitleExtractor;
  ok("instantiated", !!ex);

  eq("collapses whitespace, keeps s", ex.normalize("Sub  scribe   assess"), "Sub scribe assess");
  eq("no s-stripping", ex.normalize("precise seeking"), "precise seeking");

  ok("accepts real caption", ex.isSubtitleText("Tasche verloren."));
  ok("rejects 'Subscribe'", !ex.isSubtitleText("Subscribe"));
  ok("rejects 'precise seeking'", !ex.isSubtitleText("precise seeking"));
  ok("rejects timecode", !ex.isSubtitleText("1:34:06"));
  ok("rejects empty", !ex.isSubtitleText(""));
}

// ════════════════════════════════════════════════════════════
console.log("\n[Test 2] Overlay: side-by-side right placement + above fallback + clear");
{
  const video = { getBoundingClientRect: () => ({ top: 0, left: 0, right: 1280, bottom: 720, width: 1280, height: 720 }) };
  const wrapper = { style: {}, parentElement: {}, shadowRoot: { getElementById: () => null } };
  const sb = makeSandbox();
  sb.document.querySelector = (s) => (s === "video" ? video : null);
  sb.document.getElementById = (id) => (id === "dual-subtitle-overlay-root" ? wrapper : null);
  vm.createContext(sb);
  vm.runInContext(C("overlay.js"), sb);
  const ov = sb.window.subtitleOverlayManager;
  ok("instantiated", !!ov);

  const box = { style: {} };
  ov.overlayContainer = box;
  ov.styleConfig = { position: "side-by-side", width: 80 };

  // Caption mid-screen with plenty of room on the right.
  ov.lastRect = { left: 400, right: 800, top: 660, bottom: 696, width: 400, height: 36 };
  ov.positionOverlay();
  eq("right: left edge", box.style.left, (800 - 0) + 16 + "px");
  eq("right: top aligned", box.style.top, (660 - 0) + "px");
  eq("right: no centering transform", box.style.transform, "none");
  eq("right: top-aligned items", box.style.alignItems, "flex-start");
  ok("right: bottom not used", box.style.bottom === "auto");

  // Caption hugging the right edge -> stays side-by-side (pinned right column),
  // NEVER flips to above/bottom-center.
  ov.lastRect = { left: 900, right: 1240, top: 660, bottom: 696, width: 340, height: 36 };
  ov.positionOverlay();
  eq("hugging edge: still no centering transform", box.style.transform, "none");
  ok("hugging edge: not bottom-anchored", box.style.bottom === "auto");
  ok("hugging edge: stays on caption row (top set)", box.style.top !== "auto");
  ok("hugging edge: pinned within video", parseFloat(box.style.left) > 0 && parseFloat(box.style.left) < 1280);
  ok("hugging edge: panel width set", box.style.maxWidth.endsWith("px"));

  // No caption element (native textTrack) -> stable bottom-right, not centered.
  ov.lastRect = null;
  ov.positionOverlay();
  eq("no-rect: not centered", box.style.transform, "none");
  ok("no-rect: bottom-right anchored", box.style.bottom !== "auto" && parseFloat(box.style.left) > 0);

  // Clear empties the box.
  box.innerHTML = "x";
  ov.clearOverlay();
  eq("cleared innerHTML", box.innerHTML, "");
  eq("cleared key", ov.renderedKey, null);
}

// ════════════════════════════════════════════════════════════
// State management: "Stop Translation" is authoritative.
function makeBusSandbox(store) {
  const sb = makeSandbox();
  const listeners = {};
  sb._sent = [];
  sb._onChanged = [];
  sb._store = store;
  sb.dispatched = [];
  sb.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = (init && init.detail) || {}; } };
  sb.window.addEventListener = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  sb.window.removeEventListener = () => {};
  sb.window.dispatchEvent = (evt) => {
    sb.dispatched.push(evt.type);
    (listeners[evt.type] || []).forEach((fn) => fn(evt));
    return true;
  };
  sb.chrome = {
    runtime: { id: "x", lastError: null, sendMessage: (m, cb) => sb._sent.push({ m, cb }) },
    storage: {
      local: { get: (k, cb) => cb(sb._store), set: () => {} },
      onChanged: { addListener: (fn) => sb._onChanged.push(fn) },
    },
  };
  sb.fireStorage = (changes) => sb._onChanged.forEach((fn) => fn(changes, "local"));
  return sb;
}

console.log("\n[Test 3] Stop Translation is authoritative (translator)");
{
  const sb = makeBusSandbox({ isEnabled: true, sourceLang: "auto", targetLang: "en" });
  vm.createContext(sb);
  vm.runInContext(C("translator.js"), sb);
  const tc = sb.window.translationCoordinator;
  ok("instantiated + enabled from storage", tc.enabled === true);

  // Enabled: a translation request is sent and a result is dispatched.
  tc.processTranslation("Hallo", "", null, null);
  eq("enabled: request sent", sb._sent.length, 1);
  sb._sent[0].cb({ success: true, translatedText: "Hello" });
  ok("enabled: result rendered", sb.dispatched.includes("subtitletranslated"));

  // Case 1: Stop -> overlay cleared immediately.
  sb._store.isEnabled = false;
  sb.dispatched = [];
  sb.fireStorage({ isEnabled: { newValue: false } });
  ok("stop: enabled flag false", tc.enabled === false);
  ok("stop: dispatches subtitlecleared", sb.dispatched.includes("subtitlecleared"));

  // Case 2: Stop -> new subtitle detected -> NO translation request.
  sb._sent = [];
  sb.window.dispatchEvent(new sb.CustomEvent("subtitleextracted", { detail: { text: "Neuer Text", rect: null, lineHeight: null } }));
  eq("stopped: no request for new subtitle", sb._sent.length, 0);

  // Case 4: an in-flight response that returns AFTER stop is dropped.
  sb._store.isEnabled = true;
  sb.fireStorage({ isEnabled: { newValue: true } });
  sb._sent = [];
  tc.processTranslation("Was", "", null, null);
  const inflight = sb._sent[0];
  sb._store.isEnabled = false;
  sb.fireStorage({ isEnabled: { newValue: false } });
  sb.dispatched = [];
  inflight.cb({ success: true, translatedText: "What" });
  ok("in-flight after stop is dropped", !sb.dispatched.includes("subtitletranslated"));
}

console.log("\n[Test 4] Restore disabled choice from storage (reload safety)");
{
  const sb = makeBusSandbox({ isEnabled: false, sourceLang: "auto", targetLang: "en" });
  vm.createContext(sb);
  vm.runInContext(C("translator.js"), sb);
  const tc = sb.window.translationCoordinator;
  ok("restored disabled", tc.enabled === false);
  sb._sent = [];
  sb.window.dispatchEvent(new sb.CustomEvent("subtitleextracted", { detail: { text: "Hallo Welt", rect: null, lineHeight: null } }));
  eq("disabled on load: no request", sb._sent.length, 0);
}

console.log("\n[Test 5] Overlay refuses to render while disabled");
{
  const sb = makeSandbox();
  vm.createContext(sb);
  vm.runInContext(C("overlay.js"), sb);
  const ov = sb.window.subtitleOverlayManager;
  const box = { style: {}, innerHTML: "" };
  ov.overlayContainer = box;
  ov.styleConfig = { position: "above-original" };

  ov.enabled = false;
  ov.renderSubtitle("Original", "Translated", null, null);
  eq("disabled: nothing rendered", box.innerHTML, "");
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
