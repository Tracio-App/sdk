import { afterEach, describe, expect, it, vi } from "vitest";
import { FULL_CONFIG, expectConfigPassthrough } from "@tracio/internal-test-utils";

const seen = vi.hoisted(() => ({ calls: [] as unknown[] }));

// Подмена модуля, а не шпион по свойству: обёртки импортируют @tracio/sdk как
// CJS-сборку, и vi.spyOn на импортированном объекте до них не долетает.
// vi.hoisted нужен потому, что фабрика поднимается выше объявлений модуля.
vi.mock("@tracio/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tracio/sdk")>();
  return {
    ...actual,
    Tracio: {
      init: (cfg: unknown) => {
        seen.calls.push(cfg);
        return actual.Tracio.init(cfg as Parameters<typeof actual.Tracio.init>[0]);
      },
    },
  };
});

import { Tracio as TracioSvelte } from "../src/index.js";

describe("проброс конфига в ядро", () => {
  afterEach(() => {
    seen.calls.length = 0;
    document.head.innerHTML = "";
  });

  it("конфиг доходит до ядра без потерь", () => {
    TracioSvelte.init({ ...FULL_CONFIG });
    expect(seen.calls.length).toBeGreaterThan(0);
    expectConfigPassthrough(seen.calls[0]);
  });
});
