import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { TracioProvider, useTracio } from "../src/index.js";

describe("TracioProvider", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({
        get: () =>
          Promise.resolve({
            visitor_id: "vid-r-1",
            request_id: "req-r-1",
            bot: { detected: false, confidence: 0.1 },
          }),
      }),
    };
  });

  afterEach(() => {
    cleanup();
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
  });

  it("предоставляет tracio instance детям", () => {
    let received: unknown = null;
    function Inner() {
      received = useTracio();
      return null;
    }
    render(
      <TracioProvider publicKey="tracio_pk_r">
        <Inner />
      </TracioProvider>,
    );
    expect(received).toMatchObject({ tracio: expect.any(Object) });
  });

  it("useTracio() без Provider возвращает null tracio", () => {
    let received: unknown = null;
    function Inner() {
      received = useTracio();
      return null;
    }
    render(<Inner />);
    expect(received).toMatchObject({ tracio: null });
  });
});
