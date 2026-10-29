// Stand-in for the edge runtime, served at /s.js so the SDK builds the URL
// ITSELF (endpoint + k + lid + lid_type + lid_sig + tag) instead of being
// handed a ready one via scriptUrl.
//
// It records what actually arrived on its own tag, which is the only way to
// assert the real query-building path from inside a browser.
(function () {
  var self = document.currentScript;
  window.__tracioTagSrc = self ? self.src : null;
  // What the live bootstrap would have put in the markup — must stay null.
  window.__tracioTagFields = self ? self.getAttribute("data-tracio-fields") : null;
  // Mirror the live bootstrap (script.go): `var __f` is declared UNCONDITIONALLY
  // from the attribute, '' when absent — so the e2e can assert the global is
  // empty rather than merely undeclared.
  window.__f = self ? self.getAttribute("data-tracio-fields") || "" : "";
  window.Tracio = {
    load: function () {
      return Promise.resolve({
        get: function (opts) {
          // The custom-fields channel: an argument, read here, nowhere else.
          window.__tracioGetFields = opts && opts.fields ? opts.fields : null;
          return Promise.resolve({
            visitorId: "e2e-visitor",
            verdict: "human",
            confidence: 0.12,
            markers: ["e2e"],
          });
        },
      });
    },
  };
})();
