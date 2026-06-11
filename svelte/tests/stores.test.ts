import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { get } from "svelte/store";

import { Tracio, useTracio, useVisitorId, useTracioResult } from "../src/index.js";

const PUBLIC_KEY = "tracio_pk_s_test";

let currentInstance: ReturnType<typeof Tracio.init> | null = null;

describe("svelte stores", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({
        get: () =>
          Promise.resolve({
            visitor_id: "vid-s",
            request_id: "req-s",
            bot: { detected: false, confidence: 0.1 },
          }),
      }),
    };
  });

  afterEach(() => {
    currentInstance?.destroy();
    currentInstance = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
    document.head.innerHTML = "";
  });

  it("useVisitorId загружается", async () => {
    currentInstance = Tracio.init({ publicKey: PUBLIC_KEY });
    const store = useVisitorId();
    expect(get(store).isLoading).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(get(store).data).toBe("vid-s");
  });

  it("useTracioResult возвращает полный объект", async () => {
    currentInstance = Tracio.init({ publicKey: PUBLIC_KEY });
    const store = useTracioResult();
    await new Promise((r) => setTimeout(r, 100));
    expect(get(store).data?.bot.detected).toBe(false);
  });

  it("useTracio() escape-hatch отдаёт SDK instance", () => {
    currentInstance = Tracio.init({ publicKey: PUBLIC_KEY });
    expect(useTracio()).toBe(currentInstance);
  });

  it("useTracioResult store имеет getData() (real store)", async () => {
    currentInstance = Tracio.init({ publicKey: PUBLIC_KEY });
    const store = useTracioResult();
    expect(typeof store.subscribe).toBe("function");
    expect(typeof store.getData).toBe("function");
    await store.getData();
    expect(get(store).data?.visitorId).toBe("vid-s");
  });

  it("immediate:false не загружается до getData()", async () => {
    currentInstance = Tracio.init({ publicKey: PUBLIC_KEY });
    const store = useTracioResult({ immediate: false });
    expect(get(store).isLoading).toBe(false);
    expect(get(store).data).toBeUndefined();
    await store.getData();
    expect(get(store).data?.visitorId).toBe("vid-s");
  });
});
