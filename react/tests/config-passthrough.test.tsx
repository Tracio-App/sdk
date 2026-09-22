import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { FULL_CONFIG, expectConfigPassthrough } from "@tracio/internal-test-utils";

// vi.hoisted, а не обычный const: фабрика vi.mock поднимается выше объявлений
// модуля, и внешняя переменная в неё не долетает — массив останется пустым.
const seen = vi.hoisted(() => ({ calls: [] as unknown[] }));

// Подмена модуля, а не шпион по свойству: обёртка импортирует @tracio/sdk как
// CJS-сборку, и vi.spyOn на импортированном объекте до неё не долетает.
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

import { TracioProvider } from "../src/index.js";

// Проверяется КЛАСС ошибки, а не конкретное поле: обёртка обязана донести до
// ядра все поля конфига. Дополняет типовую страховку AssertWrapperCoversConfig
// в исходниках — та проверяет, что поле принимается, эта — что оно доезжает.
describe("проброс конфига в ядро", () => {
  afterEach(() => {
    cleanup();
    seen.calls.length = 0;
    document.head.innerHTML = "";
  });

  it("объект config доходит до ядра без потерь", () => {
    render(
      <TracioProvider config={FULL_CONFIG}>
        <div />
      </TracioProvider>,
    );
    expect(seen.calls.length).toBeGreaterThan(0);
    expectConfigPassthrough(seen.calls[0]);
  });

  it("плоские пропсы доходят до ядра без потерь", () => {
    render(
      <TracioProvider {...FULL_CONFIG}>
        <div />
      </TracioProvider>,
    );
    expect(seen.calls.length).toBeGreaterThan(0);
    expectConfigPassthrough(seen.calls[0]);
  });
});
