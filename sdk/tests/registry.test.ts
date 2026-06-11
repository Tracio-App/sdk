import { afterEach, describe, expect, it } from "vitest";

import { getRegistry, type TracioRegistry } from "../src/registry.js";

describe("registry", () => {
  afterEach(() => {
    getRegistry().clear();
  });

  it("getRegistry() возвращает один и тот же объект между вызовами", () => {
    const a = getRegistry();
    const b = getRegistry();
    expect(a).toBe(b);
  });

  it("registry хранит instance по publicKey", () => {
    const r = getRegistry();
    const fake = { destroyed: false } as unknown as TracioRegistry extends Map<infer _, infer V>
      ? V
      : never;
    r.set("tracio_pk_a", fake);
    expect(r.get("tracio_pk_a")).toBe(fake);
    expect(r.get("tracio_pk_b")).toBeUndefined();
  });

  it("registry переживает re-import модуля (имитация HMR)", async () => {
    const r1 = getRegistry();
    r1.set("tracio_pk_hmr", { destroyed: false } as never);

    const fresh = (await import(
      "../src/registry.js?fresh=" + Date.now()
    )) as typeof import("../src/registry.js");
    expect(fresh.getRegistry().get("tracio_pk_hmr")).toBeDefined();
  });
});
