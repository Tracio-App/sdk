import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildFakeTracioScript } from "@tracio/internal-test-utils";

import { Tracio } from "../src/index.js";
import { getRegistry } from "../src/registry.js";

describe("integration: full lifecycle через fake edge script", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
  });

  afterEach(() => {
    for (const inst of getRegistry().values()) inst.destroy();
    getRegistry().clear();
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
  });

  function evalFakeScript(opts: Parameters<typeof buildFakeTracioScript>[0] = {}) {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(buildFakeTracioScript(opts))();
  }

  it("получает visitorId после полного цикла", async () => {
    evalFakeScript({ visitorId: "vid-integration", requestId: "req-integration" });

    const t = Tracio.init({ publicKey: "tracio_pk_intg", timeoutMs: 500 });
    expect(await t.getVisitorId()).toBe("vid-integration");
  });

  it("полный TracioResult со всеми полями bot", async () => {
    evalFakeScript({
      visitorId: "vid-bot",
      requestId: "req-bot",
      botDetected: true,
      confidence: 0.99,
      reasons: ["headless-chrome", "no-canvas"],
    });

    const t = Tracio.init({ publicKey: "tracio_pk_bot", timeoutMs: 500 });
    const result = await t.getResult();
    expect(result).toEqual({
      visitorId: "vid-bot",
      requestId: "req-bot",
      bot: {
        detected: true,
        confidence: 0.99,
        reasons: ["headless-chrome", "no-canvas"],
      },
    });
  });

  it("onReady срабатывает с правильным payload", async () => {
    evalFakeScript({ visitorId: "vid-ready", requestId: "req-ready" });

    const t = Tracio.init({ publicKey: "tracio_pk_ready", timeoutMs: 500 });
    const result = await new Promise<unknown>((resolve) => {
      t.onReady(resolve);
    });
    expect(result).toMatchObject({ visitorId: "vid-ready" });
  });

  it("delay не блокирует API", async () => {
    evalFakeScript({ visitorId: "vid-delay", delayMs: 50 });

    const t = Tracio.init({ publicKey: "tracio_pk_delay", timeoutMs: 500 });
    expect(await t.getVisitorId()).toBe("vid-delay");
  });
});
