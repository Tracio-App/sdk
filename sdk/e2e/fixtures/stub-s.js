// Stand-in for the edge `s.js` runtime. Mirrors the LIVE edge collect shape:
// an ASYNC `load()` resolving to `{ get }`, where `get()` resolves
// `{ canonical_uid, verdict, confidence (0–1), markers }`.
window.Tracio = {
  load: function () {
    return Promise.resolve({
      get: function () {
        return Promise.resolve({
          canonical_uid: "e2e-visitor",
          verdict: "human",
          confidence: 0.12,
          markers: ["e2e"],
        });
      },
    });
  },
};
