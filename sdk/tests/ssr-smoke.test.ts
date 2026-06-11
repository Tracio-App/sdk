// @vitest-environment node
import { describe, expect, it } from "vitest";

describe("SSR smoke (node environment)", () => {
  it("ESM import не падает", async () => {
    const mod = await import("../src/index.js");
    expect(mod.Tracio).toBeDefined();
    expect(mod.TracioError).toBeDefined();
    expect(mod.isTracioError).toBeDefined();
  });

  it("Tracio.init на сервере возвращает stub без побочек", async () => {
    const { Tracio } = await import("../src/index.js");
    const inst = Tracio.init({ publicKey: "tracio_pk_ssr" });
    expect(inst.publicKey).toBe("tracio_pk_ssr");
    expect(inst.destroyed).toBe(false);
    expect(typeof document).toBe("undefined");
  });

  it("getResult на сервере реджектит 'non_browser' (не висит pending)", async () => {
    const { Tracio, isTracioError } = await import("../src/index.js");
    const inst = Tracio.init({ publicKey: "tracio_pk_ssr_reject" });
    await expect(inst.getResult()).rejects.toMatchObject({ code: "non_browser" });
    await inst.getResult().catch((e: unknown) => {
      expect(isTracioError(e)).toBe(true);
    });
  });

  it("getVisitorId на сервере тоже реджектит 'non_browser'", async () => {
    const { Tracio } = await import("../src/index.js");
    const inst = Tracio.init({ publicKey: "tracio_pk_ssr_vid" });
    await expect(inst.getVisitorId()).rejects.toMatchObject({ code: "non_browser" });
  });

  it("onReady/onError на сервере — no-op без зависших fetch'ей", async () => {
    const { Tracio } = await import("../src/index.js");
    const inst = Tracio.init({ publicKey: "tracio_pk_ssr_listeners" });
    expect(() => inst.onReady(() => {})).not.toThrow();
    expect(() => inst.onError(() => {})).not.toThrow();
    // No in-flight promise should be started on the server.
    const race = await Promise.race([
      inst.getResult().then(
        () => "resolved",
        () => "rejected",
      ),
      new Promise((r) => setTimeout(() => r("timeout-fallback"), 50)),
    ]);
    expect(race).toBe("rejected");
  });

  it("destroy() на сервере не падает", async () => {
    const { Tracio } = await import("../src/index.js");
    const inst = Tracio.init({ publicKey: "tracio_pk_ssr_destroy" });
    expect(() => inst.destroy()).not.toThrow();
    expect(inst.destroyed).toBe(true);
  });
});
