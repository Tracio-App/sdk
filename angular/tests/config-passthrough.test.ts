import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TestBed } from "@angular/core/testing";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from "@angular/platform-browser-dynamic/testing";
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

import { provideTracio, TracioService } from "../src/index.js";
import { Tracio } from "@tracio/sdk";

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: true },
  });
});

describe("проброс конфига в ядро", () => {
  afterEach(() => {
    seen.calls.length = 0;
    TestBed.resetTestingModule();
    document.head.innerHTML = "";
  });

  it("конфиг доходит до ядра без потерь", () => {
    TestBed.configureTestingModule({ providers: [...provideTracio({ ...FULL_CONFIG })] });
    TestBed.inject(TracioService);
    expect(seen.calls.length).toBeGreaterThan(0);
    expectConfigPassthrough(seen.calls[0]);
  });
});

describe("жизненный цикл сервиса", () => {
  it("ngOnDestroy освобождает инстанс — иначе он переживает весь набор тестов", () => {
    // destroyAfterEach: true — TestBed сам уничтожает инжектор после теста и
    // сам зовёт ngOnDestroy. Это и есть проверяемый механизм: раньше при
    // destroyAfterEach: false фреймворк ngOnDestroy не вызывал вовсе, и тест
    // подтверждал лишь то, что метод существует.

    // Реестр ядра лежит на globalThis и переживает TestBed.resetTestingModule().
    // Без destroy второй TestBed с ДРУГИМ ключом получает multiple_keys прямо
    // из конструктора — падает не тест, а вся сюита.
    TestBed.configureTestingModule({
      providers: [
        provideTracio({ publicKey: "tracio_pk_ng_a", endpoint: "https://edge.passthrough.test" }),
      ],
    });
    const svc = TestBed.inject(TracioService);
    expect(typeof svc.ngOnDestroy).toBe("function");
    svc.ngOnDestroy();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTracio({ publicKey: "tracio_pk_ng_b", endpoint: "https://edge.passthrough.test" }),
      ],
    });
    expect(() => TestBed.inject(TracioService)).not.toThrow();
  });
});
