import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TracioError } from "../src/errors.js";
import { TracioInstance } from "../src/instance.js";

describe("TracioInstance", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () =>
        Promise.resolve({
          get: () =>
            Promise.resolve({
              canonical_uid: "vid-100",
              verdict: "human",
              confidence: 0.05,
            }),
        }),
    };
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
    document.head.innerHTML = "";
  });

  it("getVisitorId() возвращает visitorId из normalized result", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_inst", timeoutMs: 500 });
    expect(await inst.getVisitorId()).toBe("vid-100");
  });

  it("getResult() кэширует результат — повторный вызов не делает второго fetch", async () => {
    const getSpy = vi.fn().mockResolvedValue({
      canonical_uid: "vid-101",
      verdict: "human",
      confidence: 0.01,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = { load: () => Promise.resolve({ get: getSpy }) };

    const inst = new TracioInstance({ publicKey: "tracio_pk_cache", timeoutMs: 500 });
    const a = await inst.getResult();
    const b = await inst.getResult();
    expect(a).toBe(b);
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it("onReady(cb) срабатывает один раз после первого результата", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_ready", timeoutMs: 500 });
    const cb = vi.fn();
    inst.onReady(cb);
    await inst.getResult();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ visitorId: "vid-100" }));
  });

  it("onReady после уже-завершённой загрузки вызывается синхронно (через microtask)", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_late", timeoutMs: 500 });
    await inst.getResult();
    const cb = vi.fn();
    inst.onReady(cb);
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("destroy() удаляет script, дропает state, реджектит pending'и", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({
        get: () => new Promise(() => {}), // never resolves
      }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_destroy", timeoutMs: 5000 });
    const pending = inst.getResult();
    inst.destroy();
    await expect(pending).rejects.toBeInstanceOf(TracioError);
    await expect(pending).rejects.toMatchObject({ code: "destroyed" });
    expect(document.querySelector(`script[data-tracio-key="tracio_pk_destroy"]`)).toBeNull();
    expect(inst.destroyed).toBe(true);
  });

  it("getResult после destroy() реджектит 'destroyed'", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_after", timeoutMs: 500 });
    inst.destroy();
    await expect(inst.getResult()).rejects.toMatchObject({ code: "destroyed" });
  });

  it("конструктор кидает 'invalid_config' при пустом publicKey", () => {
    expect(() => new TracioInstance({ publicKey: "" })).toThrow(TracioError);
    expect(() => new TracioInstance({ publicKey: "" })).toThrow(/publicKey/);
  });

  it("destroy() повторный вызов — no-op (уже destroyed)", () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_double_destroy", timeoutMs: 500 });
    inst.destroy();
    expect(inst.destroyed).toBe(true);
    // Second destroy should not throw and remain destroyed
    expect(() => inst.destroy()).not.toThrow();
    expect(inst.destroyed).toBe(true);
  });

  it("debug=true: console.error вызывается когда onReady listener бросает", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const inst = new TracioInstance({
      publicKey: "tracio_pk_debug_err",
      timeoutMs: 500,
      debug: true,
    });
    inst.onReady(() => {
      throw new Error("listener boom");
    });
    await inst.getResult();
    expect(errorSpy).toHaveBeenCalledWith("[tracio] onReady listener threw", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("rejects 'timeout' если getResult превысил timeoutMs", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({
        get: () => new Promise(() => {}), // never resolves
      }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_timeout", timeoutMs: 50 });
    await expect(inst.getResult()).rejects.toMatchObject({ code: "timeout" });
  });

  it("onError(cb) вызывается при провале fetch'а", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({ get: () => Promise.reject(new Error("502")) }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_onerror", timeoutMs: 500 });
    const onErr = vi.fn();
    inst.onError(onErr);
    await expect(inst.getResult()).rejects.toBeInstanceOf(TracioError);
    expect(onErr).toHaveBeenCalledTimes(1);
    expect(onErr).toHaveBeenCalledWith(expect.objectContaining({ code: "server" }));
  });

  it("onError ПОСЛЕ уже-провалившегося fetch'а уведомляется (через microtask)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({ get: () => Promise.reject(new Error("boom")) }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_late_err", timeoutMs: 500 });
    await expect(inst.getResult()).rejects.toBeInstanceOf(TracioError);
    const lateCb = vi.fn();
    inst.onError(lateCb);
    await Promise.resolve();
    await Promise.resolve();
    expect(lateCb).toHaveBeenCalledTimes(1);
    expect(lateCb).toHaveBeenCalledWith(expect.objectContaining({ code: "server" }));
  });

  it("onReady НЕ вызывается при провале fetch'а (error-канал отдельный)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({ get: () => Promise.reject(new Error("nope")) }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_ready_no_fire", timeoutMs: 500 });
    const onReady = vi.fn();
    inst.onReady(onReady);
    await inst.getResult().catch(() => undefined);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("onError(cb) который сам бросает — debug=true логирует, не валит fetch", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({ get: () => Promise.reject(new Error("x")) }),
    };
    const inst = new TracioInstance({
      publicKey: "tracio_pk_onerr_throw",
      timeoutMs: 500,
      debug: true,
    });
    inst.onError(() => {
      throw new Error("listener boom");
    });
    await expect(inst.getResult()).rejects.toBeInstanceOf(TracioError);
    expect(errorSpy).toHaveBeenCalledWith("[tracio] onError listener threw", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("region='eu' резолвится в eu-endpoint в URL скрипта", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_eu", region: "eu", timeoutMs: 500 });
    await inst.getResult();
    const script = document.querySelector(`script[data-tracio-key="tracio_pk_eu"]`);
    expect(script?.getAttribute("src")).toContain("edge.eu.tracio.ai");
  });

  it("explicit endpoint побеждает region", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_both",
      region: "eu",
      endpoint: "https://proxy.example.com",
      timeoutMs: 500,
    });
    await inst.getResult();
    const script = document.querySelector(`script[data-tracio-key="tracio_pk_both"]`);
    expect(script?.getAttribute("src")).toContain("proxy.example.com");
    expect(script?.getAttribute("src")).not.toContain("edge.eu");
  });

  it("linkedId/tag прокидываются в query-параметры скрипта", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_tag",
      linkedId: "user-42",
      tag: "checkout",
      timeoutMs: 500,
    });
    await inst.getResult();
    const script = document.querySelector(`script[data-tracio-key="tracio_pk_tag"]`);
    const src = script?.getAttribute("src") ?? "";
    expect(src).toContain("lid=user-42");
    expect(src).toContain("tag=checkout");
  });
});
