import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { buildFakeTracioScript, type FakeScriptOptions } from "./fake-tracio-script.js";

export interface MockEdgeServerOptions extends FakeScriptOptions {
  endpoint?: string;
}

export interface MockEdgeServerHandle {
  start(): void;
  stop(): void;
  reset(): void;
  url(): string;
}

export function mockEdgeServer(opts: MockEdgeServerOptions = {}): MockEdgeServerHandle {
  const endpoint = opts.endpoint ?? "https://edge.tracio.test";
  const script = buildFakeTracioScript(opts);

  const server = setupServer(
    http.get(`${endpoint}/s.js`, () => {
      return new HttpResponse(script, {
        status: 200,
        headers: { "content-type": "application/javascript" },
      });
    }),
  );

  return {
    start: () => server.listen({ onUnhandledRequest: "error" }),
    stop: () => server.close(),
    reset: () => server.resetHandlers(),
    url: () => endpoint,
  };
}
