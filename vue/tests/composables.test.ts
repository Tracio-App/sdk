import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { VueWrapper } from "@vue/test-utils";

import { TracioPlugin, useVisitorId, useTracioResult } from "../src/index.js";

// Use the same public key across tests so the singleton registry is reused.
const PUBLIC_KEY = "tracio_pk_vc";

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Tracio = {
    load: () => ({
      get: () =>
        Promise.resolve({
          visitor_id: "vid-vc",
          request_id: "req-vc",
          bot: { detected: false, confidence: 0.1 },
        }),
    }),
  };
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).Tracio;
  document.head.innerHTML = "";
});

describe("composables", () => {
  it("useVisitorId reactive — loading → data", async () => {
    const Inner = defineComponent({
      setup() {
        const { data, isLoading } = useVisitorId();
        return () =>
          h(
            "span",
            { "data-testid": "v" },
            isLoading.value ? "loading" : (data.value ?? "no-data"),
          );
      },
    });
    wrapper = mount(Inner, {
      global: { plugins: [[TracioPlugin, { publicKey: PUBLIC_KEY }]] },
    });
    expect(wrapper.get('[data-testid="v"]').text()).toBe("loading");
    await flushPromises();
    expect(wrapper.get('[data-testid="v"]').text()).toBe("vid-vc");
  });

  it("useTracioResult возвращает полный result", async () => {
    const C = defineComponent({
      setup() {
        const { data, isLoading } = useTracioResult();
        return () =>
          h(
            "span",
            { "data-testid": "r" },
            isLoading.value ? "loading" : JSON.stringify(data.value),
          );
      },
    });
    wrapper = mount(C, {
      global: { plugins: [[TracioPlugin, { publicKey: PUBLIC_KEY }]] },
    });
    await flushPromises();
    expect(wrapper.get('[data-testid="r"]').text()).toContain("vid-vc");
  });

  it("immediate:false не фетчит на mount; getData() запускает вручную", async () => {
    let api: ReturnType<typeof useTracioResult> | null = null;
    const C = defineComponent({
      setup() {
        api = useTracioResult({ immediate: false });
        const { data, isLoading, isFetched } = api;
        return () =>
          h(
            "span",
            { "data-testid": "d" },
            `${isLoading.value ? "loading" : "idle"}|${isFetched.value}|${data.value?.visitorId ?? ""}`,
          );
      },
    });
    wrapper = mount(C, {
      global: { plugins: [[TracioPlugin, { publicKey: PUBLIC_KEY }]] },
    });
    await flushPromises();
    // No auto-fetch: not loading, not fetched, no data.
    expect(wrapper.get('[data-testid="d"]').text()).toBe("idle|false|");

    await api!.getData();
    await flushPromises();
    expect(wrapper.get('[data-testid="d"]').text()).toBe("idle|true|vid-vc");
  });
});
