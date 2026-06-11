// @vitest-environment node
import { describe, expect, it } from "vitest";
import { runInInjectionContext, Injector, PLATFORM_ID } from "@angular/core";

import { provideTracio, TracioService } from "../src/index.js";

describe("SSR", () => {
  it("на сервере signals остаются null, без crash", () => {
    const injector = Injector.create({
      providers: [
        ...provideTracio({ publicKey: "tracio_pk_ssr_a" }),
        { provide: PLATFORM_ID, useValue: "server" },
      ],
    });
    const svc = runInInjectionContext(injector, () => injector.get(TracioService));
    expect(svc.visitorId()).toBeNull();
    expect(svc.result()).toBeNull();
    expect(svc.error()).toBeNull();
  });
});
