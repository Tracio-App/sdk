// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { TracioProvider, useVisitorId } from "../src/index.js";

describe("SSR", () => {
  it("renderToString не падает", () => {
    function Inner() {
      const { isLoading, data } = useVisitorId();
      return <div>{isLoading ? "loading" : (data ?? "")}</div>;
    }
    const html = renderToString(
      <TracioProvider publicKey="tracio_pk_ssr">
        <Inner />
      </TracioProvider>,
    );
    expect(html).toContain("loading");
  });
});
