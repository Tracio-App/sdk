import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

import { TracioProvider, useVisitorId, useTracioResult } from "../src/index.js";

describe("hooks", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({
        get: () =>
          Promise.resolve({
            visitor_id: "vid-hook",
            request_id: "req-hook",
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

  it("useVisitorId() возвращает loading → data", async () => {
    function Inner() {
      const { data, isLoading } = useVisitorId();
      return <span data-testid="vid">{isLoading ? "loading" : data}</span>;
    }
    render(
      <TracioProvider publicKey="tracio_pk_h1">
        <Inner />
      </TracioProvider>,
    );
    expect(screen.getByTestId("vid").textContent).toBe("loading");
    await waitFor(() => {
      expect(screen.getByTestId("vid").textContent).toBe("vid-hook");
    });
  });

  it("useTracioResult() возвращает полный result", async () => {
    function Inner() {
      const { data, isLoading } = useTracioResult();
      return <span data-testid="res">{isLoading ? "loading" : JSON.stringify(data)}</span>;
    }
    render(
      <TracioProvider publicKey="tracio_pk_h2">
        <Inner />
      </TracioProvider>,
    );
    await waitFor(() => {
      const text = screen.getByTestId("res").textContent ?? "";
      expect(text).toContain("vid-hook");
      expect(text).toContain('"detected":false');
    });
  });

  it("hooks без Provider возвращают isLoading=true, без crash", () => {
    function Inner() {
      const { isLoading, data, error } = useVisitorId();
      return (
        <span data-testid="v">{`${isLoading}|${data ?? "no-data"}|${error ?? "no-err"}`}</span>
      );
    }
    render(<Inner />);
    expect(screen.getByTestId("v").textContent).toBe("true|no-data|no-err");
  });
});
