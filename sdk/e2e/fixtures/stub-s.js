// Stand-in for the edge `s.js` runtime. On load it defines the
// `window.Tracio` global the loader polls for, with a `load().get()` that
// resolves a representative wire-shape response.
window.Tracio = {
  load: function () {
    return {
      get: function () {
        return Promise.resolve({
          visitor_id: "e2e-visitor",
          request_id: "e2e-req",
          bot: { detected: false, confidence: 12, reasons: ["e2e"] },
        });
      },
    };
  },
};
