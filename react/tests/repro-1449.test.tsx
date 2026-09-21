/**
 * Семантика custom fields в React-обёртке.
 *
 * Обёртка обязана доставлять карту в ядро НЕТРОНУТОЙ. Пока она гоняла
 * `fields` через JSON.stringify → JSON.parse, ядро получало карту, где ключ
 * с `undefined` уже исчез, а `Date` уже стал строкой, — то есть ровно те
 * предупреждения, ради которых заведена нормализация, у React-пользователей
 * не срабатывали никогда.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

import { TracioProvider, useVisitorId } from "../src/index.js";

let getCalls = 0;
let warnSpy: ReturnType<typeof vi.spyOn>;

function installMock(visitorId = "vid-repro"): void {
  getCalls = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Tracio = {
    load: () =>
      Promise.resolve({
        get: () => {
          getCalls += 1;
          return Promise.resolve({ visitorId, verdict: "human", confidence: 0.1 });
        },
      }),
  };
}

function Probe(): React.ReactElement {
  // useVisitorId отдаёт { data, isLoading, error, isFetched, getId } — поля
  // visitorId у него нет, и прежняя версия этого пробника всегда рендерила
  // undefined, то есть «визит состоялся» не проверялось вовсе.
  const { data } = useVisitorId();
  return <span data-testid="vid">{data ?? "—"}</span>;
}

function fieldsOnTag(): Record<string, unknown> | null {
  const el = document.querySelector("script[data-tracio-fields]");
  const attr = el?.getAttribute("data-tracio-fields");
  return attr ? (JSON.parse(attr) as Record<string, unknown>) : null;
}

function warnings(): string {
  return warnSpy.mock.calls.map((c) => c.join(" ")).join("\n");
}

describe("React: custom fields", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installMock();
  });

  afterEach(() => {
    cleanup();
    warnSpy.mockRestore();
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
  });

  // ── Рендер не должен падать ─────────────────────────────────────────────
  it("BigInt в fields не роняет рендер", () => {
    expect(() =>
      render(
        <TracioProvider
          publicKey="tracio_pk_r2"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fields={{ total: 10n as any, plan: "pro" }}
        >
          <Probe />
        </TracioProvider>,
      ),
    ).not.toThrow();
  });

  it("циклическая ссылка в fields не роняет рендер", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circular: any = { plan: "pro" };
    circular.self = circular;
    expect(() =>
      render(
        <TracioProvider publicKey="tracio_pk_r2b" fields={circular}>
          <Probe />
        </TracioProvider>,
      ),
    ).not.toThrow();
  });

  it("null в fields не роняет дерево — визит состоялся, поле доехало", async () => {
    expect(() =>
      render(
        <TracioProvider
          publicKey="tracio_pk_r1"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fields={{ email: null as any, plan: "pro" }}
        >
          <Probe />
        </TracioProvider>,
      ),
    ).not.toThrow();
    await waitFor(() => expect(getCalls).toBe(1));
    // null доезжает: на edge станет "" и попадёт в счётчик отвергнутых полей.
    expect(fieldsOnTag()).toEqual({ email: null, plan: "pro" });
  });

  // ── Предупреждения ядра обязаны доходить через обёртку ──────────────────
  it("undefined-ключ предупреждается — раньше его съедал JSON round-trip обёртки", async () => {
    render(
      <TracioProvider
        publicKey="tracio_pk_r4"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields={{ email: undefined as any, plan: "pro" }}
      >
        <Probe />
      </TracioProvider>,
    );
    await waitFor(() => expect(getCalls).toBe(1));
    expect(fieldsOnTag()).toEqual({ plan: "pro" });
    expect(warnings()).toContain("is undefined and was not sent");
  });

  it("Date предупреждается — раньше обёртка превращала его в строку до ядра", async () => {
    render(
      <TracioProvider
        publicKey="tracio_pk_r4b"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fields={{ signedUpAt: new Date("2026-09-15T00:00:00Z") as any, plan: "pro" }}
      >
        <Probe />
      </TracioProvider>,
    );
    await waitFor(() => expect(getCalls).toBe(1));
    expect(fieldsOnTag()).toEqual({ signedUpAt: "2026-09-15T00:00:00.000Z", plan: "pro" });
    expect(warnings()).toContain("toJSON");
  });

  // ── Идентичность карты ──────────────────────────────────────────────────
  it("перестановка ключей в fields НЕ вызывает повторный init", async () => {
    const { rerender } = render(
      <TracioProvider publicKey="tracio_pk_r9" fields={{ a: "1", b: "2" }}>
        <Probe />
      </TracioProvider>,
    );
    await waitFor(() => expect(getCalls).toBe(1));

    // Тот же набор пар, другой порядок литерала — визит не должен повториться.
    rerender(
      <TracioProvider publicKey="tracio_pk_r9" fields={{ b: "2", a: "1" }}>
        <Probe />
      </TracioProvider>,
    );
    await waitFor(() =>
      expect(document.querySelectorAll("script[data-tracio-key]").length).toBe(1),
    );
    expect(getCalls).toBe(1);
  });

  it("изменение значения в fields ПЕРЕинициализирует SDK — это осознанная цена", async () => {
    const { rerender } = render(
      <TracioProvider publicKey="tracio_pk_r10" fields={{ plan: "free" }}>
        <Probe />
      </TracioProvider>,
    );
    await waitFor(() => expect(getCalls).toBe(1));

    rerender(
      <TracioProvider publicKey="tracio_pk_r10" fields={{ plan: "pro" }}>
        <Probe />
      </TracioProvider>,
    );
    // Новое значение может доехать только новым тегом: бандл читает
    // data-tracio-fields один раз, при исполнении /s.js.
    await waitFor(() => expect(getCalls).toBe(2));
  });
  it("вложенный объект того же содержания НЕ переинициализирует SDK", async () => {
    // Ядро сознательно пропускает объекты дальше, значит такой вход поддержан.
    // Сравнение по ссылке давало бы лишний визит на каждый рендер родителя.
    const { rerender } = render(
      <TracioProvider publicKey="tracio_pk_r11" fields={{ meta: { a: 1 } as any }}>
        <Probe />
      </TracioProvider>,
    );
    await waitFor(() => expect(getCalls).toBe(1));

    rerender(
      <TracioProvider publicKey="tracio_pk_r11" fields={{ meta: { a: 1 } as any }}>
        <Probe />
      </TracioProvider>,
    );
    await waitFor(() =>
      expect(document.querySelectorAll("script[data-tracio-key]").length).toBe(1),
    );
    expect(getCalls).toBe(1);
  });
});
