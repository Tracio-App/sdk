import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";

import { TracioProvider, useTracioResult, useVisitorId, useTracio } from "../src/index.js";

let getCalls = 0;

function installMock(visitorId = "vid-dx") {
  getCalls = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Tracio = {
    load: () =>
      Promise.resolve({
        get: () => {
          getCalls += 1;
          return Promise.resolve({
            canonical_uid: visitorId,
            verdict: "human",
            confidence: 0.1,
          });
        },
      }),
  };
}

describe("React DX fixes", () => {
  beforeEach(() => {
    installMock();
  });

  afterEach(() => {
    cleanup();
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
    vi.restoreAllMocks();
  });

  // H2: inline config object must NOT re-init the SDK on every render.
  it("inline config={{...}} не реинициализирует SDK на каждый рендер", async () => {
    let forceRerender: () => void = () => {};

    function Parent() {
      const [, setN] = useState(0);
      forceRerender = () => setN((n) => n + 1);
      // Inline object literal — fresh identity every render.
      return (
        <TracioProvider config={{ publicKey: "tracio_pk_h2_inline" }}>
          <Inner />
        </TracioProvider>
      );
    }
    function Inner() {
      const { data, isLoading } = useTracioResult();
      return <span data-testid="dx">{isLoading ? "loading" : data?.visitorId}</span>;
    }

    render(<Parent />);
    await waitFor(() => {
      expect(screen.getByTestId("dx").textContent).toBe("vid-dx");
    });

    const callsAfterFirstResolve = getCalls;
    // Re-render the parent several times — config object identity changes each time.
    act(() => forceRerender());
    act(() => forceRerender());
    act(() => forceRerender());

    // Still resolved data, no flicker back to loading, and no additional fetches.
    expect(screen.getByTestId("dx").textContent).toBe("vid-dx");
    expect(getCalls).toBe(callsAfterFirstResolve);
  });

  // M3: immediate:false defers the fetch until getData() is called.
  it("useTracioResult({ immediate:false }) не фетчит до getData()", async () => {
    let triggerFetch: () => void = () => {};

    function Inner() {
      const { data, isLoading, isFetched, getData } = useTracioResult({ immediate: false });
      triggerFetch = () => void getData();
      return (
        <span data-testid="m3">{`${isLoading}|${isFetched}|${data?.visitorId ?? "none"}`}</span>
      );
    }

    render(
      <TracioProvider publicKey="tracio_pk_m3">
        <Inner />
      </TracioProvider>,
    );

    // No automatic fetch on mount.
    expect(getCalls).toBe(0);
    expect(screen.getByTestId("m3").textContent).toBe("false|false|none");

    act(() => triggerFetch());

    await waitFor(() => {
      expect(screen.getByTestId("m3").textContent).toBe("false|true|vid-dx");
    });
    expect(getCalls).toBe(1);
  });

  // M3: isFetched flips true after a default (immediate) fetch settles.
  it("isFetched переходит в true после авто-фетча", async () => {
    function Inner() {
      const { isFetched } = useTracioResult();
      return <span data-testid="fetched">{String(isFetched)}</span>;
    }
    render(
      <TracioProvider publicKey="tracio_pk_fetched">
        <Inner />
      </TracioProvider>,
    );
    expect(screen.getByTestId("fetched").textContent).toBe("false");
    await waitFor(() => {
      expect(screen.getByTestId("fetched").textContent).toBe("true");
    });
  });

  // M3: getData() resolves with the result and rejects via getId().
  it("useVisitorId({ immediate:false }).getId() резолвится через getData()", async () => {
    let captured = "";
    function Inner() {
      const { data, getId } = useVisitorId({ immediate: false });
      return (
        <button
          data-testid="btn"
          onClick={() => {
            void getId().then((id) => {
              captured = id;
            });
          }}
        >
          {data ?? "no-id"}
        </button>
      );
    }
    render(
      <TracioProvider publicKey="tracio_pk_getid">
        <Inner />
      </TracioProvider>,
    );
    expect(getCalls).toBe(0);
    act(() => {
      screen.getByTestId("btn").click();
    });
    await waitFor(() => {
      expect(captured).toBe("vid-dx");
    });
    await waitFor(() => {
      expect(screen.getByTestId("btn").textContent).toBe("vid-dx");
    });
  });

  // L5: non-TracioError rejections are narrowed into a TracioError.
  it("L5: посторонняя ошибка нормализуется в TracioError", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () =>
        Promise.resolve({
          get: () => Promise.reject(new Error("boom-raw")),
        }),
    };

    function Inner() {
      const { error, isFetched } = useTracioResult();
      return <span data-testid="err">{isFetched ? (error?.code ?? "no-code") : "pending"}</span>;
    }
    render(
      <TracioProvider publicKey="tracio_pk_l5">
        <Inner />
      </TracioProvider>,
    );
    await waitFor(() => {
      // "server" is the fallback TracioErrorCode for unknown errors.
      expect(screen.getByTestId("err").textContent).toBe("server");
    });
  });

  // getData() against a missing instance rejects with a TracioError.
  it("getData() без instance реджектит TracioError", async () => {
    let code = "";
    function Inner() {
      const { getData } = useTracioResult({ immediate: false });
      return (
        <button
          data-testid="no-inst"
          onClick={() => {
            getData().catch((e: unknown) => {
              // narrow without importing the type into the test surface
              code = (e as { code?: string }).code ?? "unknown";
            });
          }}
        >
          go
        </button>
      );
    }
    // Rendered WITHOUT a Provider — useTracio() yields null.
    render(<Inner />);
    act(() => {
      screen.getByTestId("no-inst").click();
    });
    await waitFor(() => {
      expect(code).toBe("invalid_config");
    });
  });

  // Backward-compat: default useTracio() still provides an instance.
  it("useTracio() всё ещё отдаёт instance (backward-compat)", () => {
    let received: unknown = null;
    function Inner() {
      received = useTracio();
      return null;
    }
    render(
      <TracioProvider publicKey="tracio_pk_compat">
        <Inner />
      </TracioProvider>,
    );
    expect(received).toMatchObject({ tracio: expect.any(Object) });
  });
});
