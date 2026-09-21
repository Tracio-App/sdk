import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
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

import { TracioPlugin } from "../src/index.js";

// Класс ошибки, а не конкретное поле: обёртка обязана донести до ядра ВСЕ поля
// конфига. Пара к типовой страховке AssertWrapperCoversConfig в исходниках.
describe("проброс конфига в ядро", () => {
  afterEach(() => {
    seen.calls.length = 0;
    document.head.innerHTML = "";
  });

  it("плоский конфиг доходит до ядра без потерь", () => {
    const app = createApp(defineComponent({ render: () => h("div") }));
    app.use(TracioPlugin, { ...FULL_CONFIG });
    expect(seen.calls.length).toBeGreaterThan(0);
    expectConfigPassthrough(seen.calls[0]);
  });

  it("конфиг в обёртке { config } доходит до ядра без потерь", () => {
    const app = createApp(defineComponent({ render: () => h("div") }));
    app.use(TracioPlugin, { config: { ...FULL_CONFIG } });
    expect(seen.calls.length).toBeGreaterThan(0);
    expectConfigPassthrough(seen.calls[0]);
  });
});
