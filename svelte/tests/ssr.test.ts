// @vitest-environment node
import { describe, expect, it } from "vitest";
import { get } from "svelte/store";

import { Tracio, useVisitorId } from "../src/index.js";

describe("SSR", () => {
  it("Tracio.init на сервере не падает", () => {
    expect(() => Tracio.init({ publicKey: "tracio_pk_ssr_s" })).not.toThrow();
  });

  it("useVisitorId на сервере возвращает store с isLoading=true", () => {
    const store = useVisitorId();
    expect(get(store).isLoading).toBe(true);
    expect(get(store).data).toBeUndefined();
  });
});
