/**
 * Семантика custom fields (PR #1449 и последующий аудит).
 *
 * Опорный принцип — тот же, что записан на edge (fieldsvalidate.go):
 * «Отвергается ПОЛЕ, событие сохраняется: потерять визит из-за кривого
 * поля хуже, чем потерять поле». На стороне SDK этот инвариант до сих пор
 * держался только комментарием — здесь он становится тестом.
 *
 * Ключевое следствие: SDK ПРЕДУПРЕЖДАЕТ, но не глушит. Поле, выброшенное
 * на клиенте, не доедет до edge, не попадёт в отказы и не будет видно в
 * счётчике отвергнутых полей кабинета — то есть замолчит ровно в тот
 * момент, когда у интегратора проблема.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TracioError } from "../src/errors.js";
import { TracioInstance } from "../src/instance.js";
import { injectScript } from "../src/loader.js";

function installEdgeMock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Tracio = {
    load: () =>
      Promise.resolve({
        get: () => Promise.resolve({ visitorId: "vid-repro", verdict: "human", confidence: 0.1 }),
      }),
  };
}

function fieldsOnTag(): Record<string, unknown> | null {
  const el = document.querySelector("script[data-tracio-fields]");
  const attr = el?.getAttribute("data-tracio-fields");
  return attr ? (JSON.parse(attr) as Record<string, unknown>) : null;
}

let warnSpy: ReturnType<typeof vi.spyOn>;

/** Все предупреждения одной строкой — удобнее ассертить подстроку. */
function warnings(): string {
  return warnSpy.mock.calls.map((c) => c.join(" ")).join("\n");
}

describe("custom fields — предупреждать, но не глушить", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installEdgeMock();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
  });

  // ── Визит важнее поля ───────────────────────────────────────────────────
  it("null в значении НЕ роняет init: поле доезжает, edge отвергнет его сам", async () => {
    // Гость: user.email === null. Нормальное состояние данных, не баг кода.
    const inst = new TracioInstance({
      publicKey: "tracio_pk_r1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: { email: null as any, plan: "pro" },
    });
    await inst.getResult();
    // Доезжает ОБА поля: null на edge станет "" и попадёт в счётчик отказов.
    expect(fieldsOnTag()).toEqual({ email: null, plan: "pro" });
    expect(warnings()).toContain('fields["email"]');
  });

  it("число НЕ роняет init и доезжает — edge коэрсит его так же, как для ручного тега", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_r2",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: { total: 42 as any, order: "A-1029" },
    });
    await inst.getResult();
    expect(fieldsOnTag()).toEqual({ total: 42, order: "A-1029" });
    expect(warnings()).toContain("stores it as text");
  });

  it("fields не карта — визит живёт, набор не отправляется, есть предупреждение", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_r3",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: "email=x" as any,
    });
    const res = await inst.getResult();
    expect(res.visitorId).toBe("vid-repro");
    expect(fieldsOnTag()).toBeNull();
    expect(warnings()).toContain("plain object");
  });

  // ── Молчаливых потерь быть не должно ────────────────────────────────────
  it("undefined-значение: ключ не уходит, но интегратор об этом узнаёт", async () => {
    // Самый частый случай: user.plan не инициализирован. JSON.stringify
    // выбрасывает ключ, `f` не уходит вовсе, счётчик отказов не растёт —
    // без warn это полностью немой отказ.
    const inst = new TracioInstance({
      publicKey: "tracio_pk_r4",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: { plan: undefined as any, order: "A-1" },
    });
    await inst.getResult();
    expect(fieldsOnTag()).toEqual({ order: "A-1" });
    expect(warnings()).toContain("is undefined and was not sent");
  });

  it("Date подменяется строкой — это предупреждается, потому что значение не то, что написал вызывающий", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_r5",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: { signedUpAt: new Date("2026-09-15T00:00:00Z") as any },
    });
    await inst.getResult();
    expect(fieldsOnTag()).toEqual({ signedUpAt: "2026-09-15T00:00:00.000Z" });
    expect(warnings()).toContain("toJSON");
  });

  it("объект в значении доезжает, но предупреждается — edge отвергает его как одно поле", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_r6",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: { prefs: { a: 1 } as any, plan: "pro" },
    });
    await inst.getResult();
    expect(fieldsOnTag()).toEqual({ prefs: { a: 1 }, plan: "pro" });
    expect(warnings()).toContain("takes scalars only");
  });

  // ── Несериализуемое убирается: иначе падает весь визит ──────────────────
  it("BigInt убирается, соседи доезжают — JSON.stringify иначе бросает", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_r7",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: { total: 10n as any, plan: "pro" },
    });
    await inst.getResult();
    expect(fieldsOnTag()).toEqual({ plan: "pro" });
    expect(warnings()).toContain("BigInt");
  });

  it("циклическая ссылка не роняет визит — набор не отправляется", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circular: any = { plan: "pro" };
    circular.self = circular;
    const inst = new TracioInstance({ publicKey: "tracio_pk_r8", fields: circular });
    const res = await inst.getResult();
    expect(res.visitorId).toBe("vid-repro");
    expect(fieldsOnTag()).toBeNull();
    expect(warnings()).toContain("circular");
  });

  // ── Лимиты edge: предупреждаем, но отправляем ───────────────────────────
  it("ключ с пробелом доезжает и предупреждается — отвергнет его edge, а не мы", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_r9",
      fields: { "order ref": "A-1029" },
    });
    await inst.getResult();
    expect(fieldsOnTag()).toEqual({ "order ref": "A-1029" });
    expect(warnings()).toContain("invalid key");
  });

  it("пустое значение доезжает и предупреждается", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_r10", fields: { email: "" } });
    await inst.getResult();
    expect(fieldsOnTag()).toEqual({ email: "" });
    expect(warnings()).toContain("is empty");
  });

  it("длина считается в БАЙТАХ, как len() в Go, а не в UTF-16", async () => {
    // 300 кириллических символов = 600 байт при .length === 300.
    const tooLong = "я".repeat(300);
    const ok = "я".repeat(200); // 400 байт — влезает
    const inst = new TracioInstance({
      publicKey: "tracio_pk_r11",
      fields: { ok, tooLong },
    });
    await inst.getResult();
    expect(fieldsOnTag()).toEqual({ ok, tooLong });
    expect(warnings()).toContain("exceeds 500 bytes");
    expect(warnings()).not.toContain('fields["ok"]');
  });

  // ── Мутация после init ──────────────────────────────────────────────────
  it("мутация объекта после init не попадает на провод", async () => {
    const live: Record<string, string> = { plan: "pro" };
    const inst = new TracioInstance({ publicKey: "tracio_pk_r12", fields: live });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (live as any).plan = 42;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (live as any).sneaked = "x".repeat(5000);
    await inst.getResult();
    expect(fieldsOnTag()).toEqual({ plan: "pro" });
  });

  // ── Существующий тег ────────────────────────────────────────────────────
  it("при уже существующем теге поля не уходят — но интегратор об этом узнаёт", async () => {
    // Бандл читает data-tracio-fields в момент исполнения /s.js и больше не
    // перечитывает, поэтому дописать атрибут постфактум нельзя: на
    // загрузившемся теге это no-op, на чужом — подмешивание в чужую интеграцию.
    const pre = document.createElement("script");
    pre.setAttribute("data-tracio-key", "tracio_pk_r13");
    document.head.appendChild(pre);

    const inst = new TracioInstance({
      publicKey: "tracio_pk_r13",
      fields: { email: "user@example.com" },
    });
    await inst.getResult();
    expect(pre.getAttribute("data-tracio-fields")).toBeNull();
    expect(warnings()).toContain("already exists");
  });

  // ── publicKey не должен ломать CSS-селектор ─────────────────────────────
  it("publicKey с кавычкой: не бросает И селектор продолжает находить свой тег", () => {
    const weird = 'tracio_pk_"x';
    expect(() => injectScript("https://edge.tracio.test/s.js", weird)).not.toThrow();
    // Контракт tagSelector — не «не бросить», а «найти свой тег»: без
    // экранирования дедуп ломается молча и на странице оказывается два тега.
    injectScript("https://edge.tracio.test/s.js", weird);
    expect(document.querySelectorAll("script[data-tracio-key]").length).toBe(1);
  });

  // ── debug не должен печатать идентификатор аккаунта и подпись ───────────
  it("debug не печатает lid и lid_sig", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const inst = new TracioInstance({
      publicKey: "tracio_pk_dbg2",
      linkedId: "user@example.com",
      linkedIdType: "email",
      linkedIdSig: "s".repeat(64),
      tag: "checkout",
      debug: true,
    });
    await inst.getResult();
    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("injecting");
    // Сырой идентификатор и подпись уезжали в консоль, а оттуда в breadcrumbs
    // Sentry/LogRocket/Datadog RUM.
    expect(logged).not.toContain("user@example.com");
    expect(logged).not.toContain("s".repeat(64));
    // Несекретные параметры остаются читаемыми — иначе лог бесполезен.
    expect(logged).toContain("tag=checkout");
    expect(logged).toContain("lid_type=email");
    logSpy.mockRestore();
  });

  // ── отказ не мемоизируется навсегда ─────────────────────────────────────
  it("транзиентный отказ не кэшируется: повтор делает НОВУЮ попытку", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
    const inst = new TracioInstance({ publicKey: "tracio_pk_retry", timeoutMs: 30 });

    await expect(inst.getResult()).rejects.toBeInstanceOf(TracioError);
    // Мёртвый тег снят, иначе повтор упрётся в него ранним выходом injectScript
    // и просто просидит весь бюджет.
    expect(document.querySelectorAll("script[data-tracio-key]").length).toBe(0);

    installEdgeMock();
    // Прежде сюда возвращался ТОТ ЖЕ отклонённый промис — синхронно, без сети.
    const res = await inst.getResult();
    expect(res.visitorId).toBe("vid-repro");
  });

  // ── timeoutMs ───────────────────────────────────────────────────────────
  it("timeoutMs: NaN не роняет init и не оставляет вечный интервал", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_r14",
      timeoutMs: Number(undefined),
    });
    const res = await inst.getResult();
    expect(res.visitorId).toBe("vid-repro");
    expect(warnings()).toContain("timeoutMs");
  });

  // ── Ответ без идентичности ──────────────────────────────────────────────
  it("ответ edge без visitorId не резолвится успехом — иначе фрод-гейт откроется fail-open", async () => {
    // Повторный primary POST на завершённой сессии отдаёт {"ok": true} без id.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => Promise.resolve({ get: () => Promise.resolve({ ok: true }) }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_r15" });
    await expect(inst.getResult()).rejects.toBeInstanceOf(TracioError);
  });
});
