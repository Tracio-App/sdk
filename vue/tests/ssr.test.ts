// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToString } from "@vue/server-renderer";
import { createSSRApp, defineComponent, h } from "vue";

import { TracioPlugin, useVisitorId } from "../src/index.js";

describe("SSR", () => {
  it("renderToString не падает", async () => {
    const C = defineComponent({
      setup() {
        const { isLoading, data } = useVisitorId();
        return () => h("div", isLoading.value ? "loading" : (data.value ?? ""));
      },
    });
    const app = createSSRApp(C);
    app.use(TracioPlugin, { publicKey: "tracio_pk_ssr_v" });
    const html = await renderToString(app);
    expect(html).toContain("loading");
  });
});
