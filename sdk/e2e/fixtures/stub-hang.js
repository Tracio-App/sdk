// Loads successfully (HTTP 200) but deliberately never defines
// `window.Tracio` — exercises the waitForGlobal timeout branch, which must
// reject with TracioError("blocked") (the adblock/CSP signal).
window.__tracioHangLoaded = true;
