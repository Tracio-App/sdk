import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { collectAttribution } from "../src/attribution.js";
import { Tracio } from "../src/init.js";
import { getRegistry } from "../src/registry.js";

describe("collectAttribution", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("берёт только перечисленные параметры, остальное не уходит", () => {
    const out = collectAttribution("?click_id=ck1&aff_id=a7&token=secret", ["click_id", "aff_id"]);
    expect({ ...out }).toEqual({ "aff.click_id": "ck1", "aff.aff_id": "a7" });
    expect(JSON.stringify(out)).not.toContain("secret");
  });

  it("без опции — ни одного aff.*", () => {
    expect({ ...collectAttribution("?click_id=ck1", []) }).toEqual({});
  });

  it("11 параметров — взято 10 и console.warn", () => {
    const names = Array.from({ length: 11 }, (_, i) => `p${i}`);
    const search = "?" + names.map((n) => `${n}=v`).join("&");
    const out = collectAttribution(search, names);
    expect(Object.keys(out)).toHaveLength(10);
    expect(out["aff.p10"]).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("значение длиннее 500 байт отброшено", () => {
    const out = collectAttribution(`?a=${"x".repeat(501)}&b=${"y".repeat(500)}`, ["a", "b"]);
    expect(out["aff.a"]).toBeUndefined();
    expect(out["aff.b"]).toHaveLength(500);
  });

  it("многобайтное значение считается в байтах", () => {
    const out = collectAttribution(`?a=${encodeURIComponent("я".repeat(251))}`, ["a"]);
    expect(out["aff.a"]).toBeUndefined();
  });

  it("ключ длиннее 40 символов с префиксом или с недопустимыми символами отброшен", () => {
    const long = "k".repeat(37); // "aff." + 37 = 41
    const ok = "k".repeat(36); // 40
    const out = collectAttribution(`?${long}=1&${ok}=2&bad key=3&a%20b=4`, [
      long,
      ok,
      "bad key",
      "a b",
    ]);
    expect(Object.keys(out)).toEqual([`aff.${ok}`]);
  });

  it("пустое и отсутствующее значение пропускается", () => {
    expect({ ...collectAttribution("?a=&c=1", ["a", "b", "c"]) }).toEqual({ "aff.c": "1" });
  });
});

describe("attribution в Tracio.init", () => {
  let received: unknown;
  beforeEach(() => {
    document.head.innerHTML = "";
    received = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () =>
        Promise.resolve({
          get: (opts: unknown) => {
            received = opts;
            return Promise.resolve({ canonical_uid: "v", verdict: "human", confidence: 0 });
          },
        }),
    };
    window.history.replaceState({}, "", "/?click_id=ck1&aff_id=a7&token=secret");
  });
  afterEach(() => {
    for (const inst of getRegistry().values()) inst.destroy();
    getRegistry().clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
    document.head.innerHTML = "";
    window.history.replaceState({}, "", "/");
  });

  async function run(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const inst = Tracio.init({ publicKey: "tracio_pk_attr", ...config });
    const p = inst.getResult();
    await vi.waitFor(() => expect(document.querySelector("script")).not.toBeNull());
    document.querySelector("script")!.dispatchEvent(new Event("load"));
    await p;
    return (received as { fields: Record<string, unknown> }).fields;
  }

  it("поля попадают в get({fields}); явный fields приоритетнее", async () => {
    const fields = await run({
      attribution: { params: ["click_id", "aff_id"] },
      fields: { "aff.click_id": "mine", plan: "pro" },
    });
    expect({ ...fields }).toEqual({ "aff.click_id": "mine", "aff.aff_id": "a7", plan: "pro" });
  });
});
