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

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: false },
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
