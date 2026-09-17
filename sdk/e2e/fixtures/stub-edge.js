// Stand-in for the edge runtime, served at /s.js so the SDK builds the URL
// ITSELF (endpoint + k + lid + lid_type + lid_sig + tag) instead of being
// handed a ready one via scriptUrl.
//
// It records what actually arrived on its own tag, which is the only way to
// assert the real query-building path from inside a browser.
(function () {
  var self = document.currentScript;
  window.__tracioTagSrc = self ? self.src : null;
  window.__tracioTagFields = self ? self.getAttribute("data-tracio-fields") : null;
  window.Tracio = {
    load: function () {
      return Promise.resolve({
        get: function () {
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
