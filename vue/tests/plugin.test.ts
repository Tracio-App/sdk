import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import { TracioPlugin, useTracio } from "../src/index.js";

describe("TracioPlugin", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({
        get: () =>
          Promise.resolve({
            visitor_id: "vid-v",
            request_id: "req-v",
            bot: { detected: false, confidence: 0.1 },
          }),
      }),
    };
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
    document.head.innerHTML = "";
  });

  it("provide/inject — useTracio() возвращает instance", () => {
    let received: unknown = null;
    const Inner = defineComponent({
      setup() {
        received = useTracio();
        return () => h("div");
      },
    });
    const app = createApp(Inner);
    app.use(TracioPlugin, { publicKey: "tracio_pk_v" });
    const el = document.createElement("div");
    app.mount(el);
    expect(received).toBeTruthy();
    app.unmount();
  });

  it("принимает config-object форму ({ config })", () => {
    let received: unknown = null;
    const Inner = defineComponent({
      setup() {
        received = useTracio();
        return () => h("div");
      },
    });
    const app = createApp(Inner);
    app.use(TracioPlugin, { config: { publicKey: "tracio_pk_v_cfg" } });
    app.mount(document.createElement("div"));
    expect(received).toBeTruthy();
    app.unmount();
  });

  it("destroy()-ит instance на app.unmount (no leak)", () => {
    let inst: { destroyed: boolean } | null = null;
    const Inner = defineComponent({
      setup() {
        inst = useTracio() as unknown as { destroyed: boolean };
        return () => h("div");
      },
    });
    const app = createApp(Inner);
    app.use(TracioPlugin, { publicKey: "tracio_pk_v_destroy" });
    app.mount(document.createElement("div"));
    expect(inst).toBeTruthy();
    expect(inst!.destroyed).toBe(false);
    app.unmount();
    expect(inst!.destroyed).toBe(true);
  });
});
