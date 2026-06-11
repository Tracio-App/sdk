export interface FakeScriptOptions {
  visitorId?: string;
  requestId?: string;
  botDetected?: boolean;
  confidence?: number;
  reasons?: string[];
  delayMs?: number;
  failure?: "throw" | "no-global";
}

export function buildFakeTracioScript(opts: FakeScriptOptions = {}): string {
  const {
    visitorId = "00000000-0000-4000-8000-000000000001",
    requestId = "req_00000000",
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

  const payload = JSON.stringify({
    visitor_id: visitorId,
    request_id: requestId,
    bot: { detected: botDetected, confidence, reasons },
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
          return {
            get: function() {
              return asPromise(payload, ${delayMs});
            }
          };
        }
      };
    })();
  `;
}
