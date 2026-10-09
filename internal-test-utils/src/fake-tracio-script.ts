export interface FakeScriptOptions {
  visitorId?: string;
  botDetected?: boolean;
  /** Confidence on the edge's 0–1 scale (the SDK rescales it to 0–100). */
  confidence?: number;
  reasons?: string[];
  delayMs?: number;
  failure?: "throw" | "no-global";
}

export function buildFakeTracioScript(opts: FakeScriptOptions = {}): string {
  const {
    visitorId = "00000000-0000-4000-8000-000000000001",
    botDetected = false,
    confidence = 0.1,
    reasons,
    delayMs = 0,
    failure,
  } = opts;

  if (failure === "no-global") {
    return `/* fake script: deliberately does not install window.Tracio */`;
  }

  if (failure === "throw") {
    return `throw new Error("fake-edge-script: forced failure");`;
  }

  // Mirror the LIVE edge collect shape: canonical_uid + verdict + a 0–1
  // confidence + markers, behind an ASYNC load() that resolves to { get }.
  // (Matching reality is the point — an idealised sync/snake_case shape is what
  // let the real loader bug ship undetected.)
  const payload = JSON.stringify({
    canonical_uid: visitorId,
    visitorId,
    verdict: botDetected ? "bot" : "human",
    confidence,
    markers: reasons,
  });

  return `
    (function() {
      var payload = ${payload};
      function asPromise(value, delay) {
        return new Promise(function(resolve) {
          setTimeout(function() { resolve(value); }, delay);
        });
      }
      window.Tracio = {
        load: function() {
          return asPromise({
            get: function() {
              return asPromise(payload, ${delayMs});
            }
          }, 0);
        }
      };
    })();
  `;
}
