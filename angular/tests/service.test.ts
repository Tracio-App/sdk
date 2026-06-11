import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TestBed } from "@angular/core/testing";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from "@angular/platform-browser-dynamic/testing";

import { provideTracio, TracioService } from "../src/index.js";

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: false },
  });
});

describe("TracioService", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({
        get: () =>
          Promise.resolve({
            visitor_id: "vid-a",
            request_id: "req-a",
            bot: { detected: false, confidence: 0.1 },
          }),
      }),
    };
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
    document.head.innerHTML = "";
    TestBed.resetTestingModule();
  });

  it("signals start null, populate after load", async () => {
    TestBed.configureTestingModule({
      providers: provideTracio({ publicKey: "tracio_pk_a" }),
    });
    const svc = TestBed.inject(TracioService);
    expect(svc.visitorId()).toBeNull();
    await new Promise((r) => setTimeout(r, 100));
    expect(svc.visitorId()).toBe("vid-a");
    expect(svc.result()?.bot.detected).toBe(false);
  });

  it("getVisitorData() императивно (re-)фетчит и возвращает result", async () => {
    // Reuse the same key as the prior test so the SDK registry returns the
    // cached live instance (init throws multiple_keys for a 2nd live key).
    TestBed.configureTestingModule({
      providers: provideTracio({ publicKey: "tracio_pk_a" }),
    });
    const svc = TestBed.inject(TracioService);
    await new Promise((r) => setTimeout(r, 100));

    const result = await svc.getVisitorData();
    expect(result?.visitorId).toBe("vid-a");
    expect(svc.visitorId()).toBe("vid-a");
    expect(svc.isLoading()).toBe(false);
    // accepts forward-compatible opts/ignoreCache without throwing
    const again = await svc.getVisitorData({ ignoreCache: true }, true);
    expect(again?.visitorId).toBe("vid-a");
  });
});
