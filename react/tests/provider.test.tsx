import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, cleanup, waitFor, screen } from "@testing-library/react";

import { TracioProvider, useTracio, useTracioResult } from "../src/index.js";

describe("TracioProvider", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () =>
        Promise.resolve({
          get: () =>
            Promise.resolve({
              canonical_uid: "vid-r-1",
              verdict: "human",
              confidence: 0.1,
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

  // Регрессия: обёртка пересобирала конфиг по полям и роняла linkedId, region и
  // tag — до ядра они не доходили. Ошибки при этом не возникало: события шли,
  // связи между аккаунтами не строились, и клиент узнавал об этом через неделю.
  // Проверяем сквозь весь путь — по URL внедрённого скрипта, а не по факту
  // передачи пропа: важно, что значение реально доехало до edge.
  describe("проброс полей конфига в ядро", () => {
    // Скрипт внедряется лениво — при первом запросе результата, а не при
    // инициализации. Поэтому дочерний компонент обязан дёрнуть getResult().
    function Consumer() {
      const { isFetched } = useTracioResult();
      return <span data-testid="s">{isFetched ? "done" : "wait"}</span>;
    }

    async function srcAfterFetch(ui: React.ReactElement): Promise<string> {
      render(ui);
      await waitFor(() => expect(screen.getByTestId("s").textContent).toBe("done"));
      return document.querySelector("script[data-tracio-key]")?.getAttribute("src") ?? "";
    }

    it("linkedId из плоского пропа доезжает до запроса", async () => {
      const src = await srcAfterFetch(
        <TracioProvider publicKey="tracio_pk_x" linkedId="user-42">
          <Consumer />
        </TracioProvider>,
      );
      expect(src).toContain("lid=user-42");
    });

    it("linkedId из объекта config доезжает до запроса", async () => {
      const src = await srcAfterFetch(
        <TracioProvider config={{ publicKey: "tracio_pk_x", linkedId: "user-99" }}>
          <Consumer />
        </TracioProvider>,
      );
      expect(src).toContain("lid=user-99");
    });

    it("linkedId кодируется, а не подставляется сырым", async () => {
      const src = await srcAfterFetch(
        <TracioProvider publicKey="tracio_pk_x" linkedId="a b&c">
          <Consumer />
        </TracioProvider>,
      );
      expect(src).toContain(`lid=${encodeURIComponent("a b&c")}`);
      expect(src).not.toContain("lid=a b&c");
    });

    it("region из пропа меняет адрес приёма событий", async () => {
      const src = await srcAfterFetch(
        <TracioProvider publicKey="tracio_pk_x" region="eu">
          <Consumer />
        </TracioProvider>,
      );
      expect(src).toContain("edge.eu.tracio.ai");
    });
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
