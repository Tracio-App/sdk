import { describe, expect, it } from "vitest";

import { isBrowser } from "../src/ssr.js";

describe("isBrowser", () => {
  it("возвращает true в happy-dom (browser-like environment)", () => {
    expect(isBrowser()).toBe(true);
  });

  it("возвращает false когда window отсутствует", () => {
    const originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = undefined;
    try {
      expect(isBrowser()).toBe(false);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = originalWindow;
    }
  });
});
