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

  // Caption hugging the right edge -> fall back to above.
  ov.lastRect = { left: 900, right: 1240, top: 660, bottom: 696, width: 340, height: 36 };
  ov.positionOverlay();
  ok("fallback uses bottom anchor", box.style.bottom !== "auto" && parseFloat(box.style.bottom) > 0);
  eq("fallback centers", box.style.transform, "translateX(-50%)");

  // Clear empties the box.
  box.innerHTML = "x";
  ov.clearOverlay();
  eq("cleared innerHTML", box.innerHTML, "");
  eq("cleared key", ov.renderedKey, null);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
