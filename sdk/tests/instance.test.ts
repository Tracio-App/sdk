import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TracioError } from "../src/errors.js";
import { TracioInstance } from "../src/instance.js";

describe("TracioInstance", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () =>
        Promise.resolve({
          get: () =>
            Promise.resolve({
              canonical_uid: "vid-100",
              verdict: "human",
              confidence: 0.05,
            }),
        }),
    };
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
    document.head.innerHTML = "";
  });

  it("getVisitorId() возвращает visitorId из normalized result", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_inst", timeoutMs: 500 });
    expect(await inst.getVisitorId()).toBe("vid-100");
  });

  it("getResult() кэширует результат — повторный вызов не делает второго fetch", async () => {
    const getSpy = vi.fn().mockResolvedValue({
      canonical_uid: "vid-101",
      verdict: "human",
      confidence: 0.01,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = { load: () => Promise.resolve({ get: getSpy }) };

    const inst = new TracioInstance({ publicKey: "tracio_pk_cache", timeoutMs: 500 });
    const a = await inst.getResult();
    const b = await inst.getResult();
    expect(a).toBe(b);
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it("onReady(cb) срабатывает один раз после первого результата", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_ready", timeoutMs: 500 });
    const cb = vi.fn();
    inst.onReady(cb);
    await inst.getResult();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ visitorId: "vid-100" }));
  });

  it("onReady после уже-завершённой загрузки вызывается синхронно (через microtask)", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_late", timeoutMs: 500 });
    await inst.getResult();
    const cb = vi.fn();
    inst.onReady(cb);
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("destroy() удаляет script, дропает state, реджектит pending'и", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({
        get: () => new Promise(() => {}), // never resolves
      }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_destroy", timeoutMs: 5000 });
    const pending = inst.getResult();
    inst.destroy();
    await expect(pending).rejects.toBeInstanceOf(TracioError);
    await expect(pending).rejects.toMatchObject({ code: "destroyed" });
    expect(document.querySelector(`script[data-tracio-key="tracio_pk_destroy"]`)).toBeNull();
    expect(inst.destroyed).toBe(true);
  });

  it("getResult после destroy() реджектит 'destroyed'", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_after", timeoutMs: 500 });
    inst.destroy();
    await expect(inst.getResult()).rejects.toMatchObject({ code: "destroyed" });
  });

  it("конструктор кидает 'invalid_config' при пустом publicKey", () => {
    expect(() => new TracioInstance({ publicKey: "" })).toThrow(TracioError);
    expect(() => new TracioInstance({ publicKey: "" })).toThrow(/publicKey/);
  });

  it("fields: НИ ОДНА форма не бросает — кривое поле не должно стоить визита", () => {
    const pk = "tracio_pk_fields";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const build = (fields: any) => () => new TracioInstance({ publicKey: pk, fields });

    // Прежде эти пять форм бросали invalid_config из конструктора — то есть
    // опечатка интегратора убивала визит целиком, а в React разносила всё
    // дерево. Теперь каждая только предупреждает: истина по полям живёт на
    // edge, и он отвергает поле, сохраняя событие (fieldsvalidate.go).
    expect(build(["a"])).not.toThrow();
    expect(build("x")).not.toThrow();
    expect(build(null)).not.toThrow();
    expect(build({ plan: 42 })).not.toThrow();
    expect(build({ ok: "1", flag: true })).not.toThrow();
    expect(warn).toHaveBeenCalled();

    // Валидная карта и пустая карта — по-прежнему не ошибка и не повод шуметь.
    warn.mockClear();
    expect(() => new TracioInstance({ publicKey: pk, fields: { plan: "pro" } })).not.toThrow();
    expect(() => new TracioInstance({ publicKey: pk, fields: {} })).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("подписанный lid: непарная конфигурация — 'invalid_config'", () => {
    const pk = "tracio_pk_lid_sig";
    // type/sig без самого linkedId — подписывать нечего.
    expect(() => new TracioInstance({ publicKey: pk, linkedIdType: "email" })).toThrow(/linkedId/);
    expect(() => new TracioInstance({ publicKey: pk, linkedIdSig: "a".repeat(64) })).toThrow(
      /linkedId/,
    );
    // Неизвестный тип по-прежнему отвергается.
    expect(
      () =>
        new TracioInstance({
          publicKey: pk,
          linkedId: "u1",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkedIdType: "nickname" as any,
        }),
    ).toThrow(/linkedIdType/);
    // Полная тройка валидна.
    expect(
      () =>
        new TracioInstance({
          publicKey: pk,
          linkedId: "user@example.com",
          linkedIdType: "email",
          linkedIdSig: "a".repeat(64),
        }),
    ).not.toThrow();
  });

  it("подпись БЕЗ типа валидна: непрозрачный id тоже подписывается", () => {
    const pk = "tracio_pk_lid_sig_opaque";
    // Раньше это бросало 'linkedIdSig requires linkedIdType'. Тип решает
    // пространство имён person-графа, подпись — выставил ли id сервер клиента;
    // второму вопросу тип не нужен, и требование его присылать означало, что
    // не подписывает никто (прод 02.09–05.09: 10868 привязок, подписей ноль).
    expect(
      () => new TracioInstance({ publicKey: pk, linkedId: "acct-42", linkedIdSig: "a".repeat(64) }),
    ).not.toThrow();
    // Явный opaque — то же самое, записанное словом.
    expect(
      () =>
        new TracioInstance({
          publicKey: pk + "_x",
          linkedId: "acct-42",
          linkedIdType: "opaque",
          linkedIdSig: "a".repeat(64),
        }),
    ).not.toThrow();
  });

  it("destroy() повторный вызов — no-op (уже destroyed)", () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_double_destroy", timeoutMs: 500 });
    inst.destroy();
    expect(inst.destroyed).toBe(true);
    // Second destroy should not throw and remain destroyed
    expect(() => inst.destroy()).not.toThrow();
    expect(inst.destroyed).toBe(true);
  });

  it("debug=true: console.error вызывается когда onReady listener бросает", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const inst = new TracioInstance({
      publicKey: "tracio_pk_debug_err",
      timeoutMs: 500,
      debug: true,
    });
    inst.onReady(() => {
      throw new Error("listener boom");
    });
    await inst.getResult();
    expect(errorSpy).toHaveBeenCalledWith("[tracio] onReady listener threw", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("rejects 'timeout' если getResult превысил timeoutMs", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({
        get: () => new Promise(() => {}), // never resolves
      }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_timeout", timeoutMs: 50 });
    await expect(inst.getResult()).rejects.toMatchObject({ code: "timeout" });
  });

  it("onError(cb) вызывается при провале fetch'а", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({ get: () => Promise.reject(new Error("502")) }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_onerror", timeoutMs: 500 });
    const onErr = vi.fn();
    inst.onError(onErr);
    await expect(inst.getResult()).rejects.toBeInstanceOf(TracioError);
    expect(onErr).toHaveBeenCalledTimes(1);
    expect(onErr).toHaveBeenCalledWith(expect.objectContaining({ code: "server" }));
  });

  it("onError ПОСЛЕ уже-провалившегося fetch'а уведомляется (через microtask)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({ get: () => Promise.reject(new Error("boom")) }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_late_err", timeoutMs: 500 });
    await expect(inst.getResult()).rejects.toBeInstanceOf(TracioError);
    const lateCb = vi.fn();
    inst.onError(lateCb);
    await Promise.resolve();
    await Promise.resolve();
    expect(lateCb).toHaveBeenCalledTimes(1);
    expect(lateCb).toHaveBeenCalledWith(expect.objectContaining({ code: "server" }));
  });

  it("onReady НЕ вызывается при провале fetch'а (error-канал отдельный)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({ get: () => Promise.reject(new Error("nope")) }),
    };
    const inst = new TracioInstance({ publicKey: "tracio_pk_ready_no_fire", timeoutMs: 500 });
    const onReady = vi.fn();
    inst.onReady(onReady);
    await inst.getResult().catch(() => undefined);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("onError(cb) который сам бросает — debug=true логирует, не валит fetch", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => ({ get: () => Promise.reject(new Error("x")) }),
    };
    const inst = new TracioInstance({
      publicKey: "tracio_pk_onerr_throw",
      timeoutMs: 500,
      debug: true,
    });
    inst.onError(() => {
      throw new Error("listener boom");
    });
    await expect(inst.getResult()).rejects.toBeInstanceOf(TracioError);
    expect(errorSpy).toHaveBeenCalledWith("[tracio] onError listener threw", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("region='eu' резолвится в eu-endpoint в URL скрипта", async () => {
    const inst = new TracioInstance({ publicKey: "tracio_pk_eu", region: "eu", timeoutMs: 500 });
    await inst.getResult();
    const script = document.querySelector(`script[data-tracio-key="tracio_pk_eu"]`);
    expect(script?.getAttribute("src")).toContain("edge.eu.tracio.ai");
  });

  it("explicit endpoint побеждает region", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_both",
      region: "eu",
      endpoint: "https://proxy.example.com",
      timeoutMs: 500,
    });
    await inst.getResult();
    const script = document.querySelector(`script[data-tracio-key="tracio_pk_both"]`);
    expect(script?.getAttribute("src")).toContain("proxy.example.com");
    expect(script?.getAttribute("src")).not.toContain("edge.eu");
  });

  it("linkedId/tag прокидываются в query-параметры скрипта", async () => {
    const inst = new TracioInstance({
      publicKey: "tracio_pk_tag",
      linkedId: "user-42",
      tag: "checkout",
      timeoutMs: 500,
    });
    await inst.getResult();
    const script = document.querySelector(`script[data-tracio-key="tracio_pk_tag"]`);
    const src = script?.getAttribute("src") ?? "";
    expect(src).toContain("lid=user-42");
    expect(src).toContain("tag=checkout");
  });
});

describe("TracioInstance — inline-вердикт в ответе edge", () => {
  // Ключи ответа — те, что кладёт attachInlineVerdict
  // (back/edge/internal/serve/collect.go): inline_guidance, inline_partial,
  // inline_token, request_id.
  function serve(body: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Tracio = {
      load: () => Promise.resolve({ get: () => Promise.resolve(body) }),
    };
  }

  const VERDICT = {
    visitorId: "vid-200",
    verdict: "human",
    confidence: 0.02,
    request_id: "req-abc",
    inline_guidance: {
      version: 1,
      overall: "deny",
      payment: "deny",
      registration: "review",
      login: "allow",
      affiliate: "challenge",
      basis: ["rule:deny", "list:block"],
    },
    inline_partial: true,
    inline_token: "tracio_vt1.payload.sig",
  };

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
    document.head.innerHTML = "";
  });

  it("вердикт, признак неполноты, токен и requestId доезжают до результата", async () => {
    serve(VERDICT);
    const inst = new TracioInstance({ publicKey: "tracio_pk_inline", timeoutMs: 500 });
    const result = await inst.getResult();

    expect(result.requestId).toBe("req-abc");
    expect(result.inlineToken).toBe("tracio_vt1.payload.sig");
    expect(result.inlinePartial).toBe(true);
    expect(result.inlineGuidance).toEqual({
      version: 1,
      overall: "deny",
      payment: "deny",
      registration: "review",
      login: "allow",
      affiliate: "challenge",
      basis: ["rule:deny", "list:block"],
    });
    // Ботовый verdict остался своим: новые ключи ничего не переопределяют.
    expect(result.bot.detected).toBe(false);
    expect(result.visitorId).toBe("vid-200");
  });

  it("ответ сегодняшнего edge (без новых ключей) — результат прежний, поля undefined", async () => {
    serve({ visitorId: "vid-201", verdict: "bot", confidence: 0.9, markers: ["automation"] });
    const inst = new TracioInstance({ publicKey: "tracio_pk_inline_absent", timeoutMs: 500 });
    const result = await inst.getResult();

    expect(result.visitorId).toBe("vid-201");
    expect(result.bot).toEqual({ detected: true, confidence: 90, reasons: ["automation"] });
    expect(result.requestId).toBeUndefined();
    expect(result.inlineGuidance).toBeUndefined();
    expect(result.inlinePartial).toBeUndefined();
    expect(result.inlineToken).toBeUndefined();
    // Ключей нет вовсе, а не присутствуют со значением undefined: результат
    // сериализуют в лог и шлют на бэкенд, и пустые ключи там — шум.
    expect(Object.keys(result).sort()).toEqual(["bot", "visitorId"]);
  });

  it("воркспейс без правил: вердикта нет, но остальной ответ цел", async () => {
    serve({ visitorId: "vid-202", verdict: "human", confidence: 0.1, request_id: "req-solo" });
    const inst = new TracioInstance({ publicKey: "tracio_pk_inline_norules", timeoutMs: 500 });
    const result = await inst.getResult();

    expect(result.requestId).toBe("req-solo");
    expect(result.inlineGuidance).toBeUndefined();
    // Признак неполноты без вердикта ничего не описывает и наружу не идёт.
    expect(result.inlinePartial).toBeUndefined();
  });

  it("узел без ключа подписи: вердикт есть, токена нет", async () => {
    const { inline_token: _omit, ...unsigned } = VERDICT;
    serve(unsigned);
    const inst = new TracioInstance({ publicKey: "tracio_pk_inline_unsigned", timeoutMs: 500 });
    const result = await inst.getResult();

    expect(result.inlineGuidance?.payment).toBe("deny");
    expect(result.inlineToken).toBeUndefined();
  });

  it("совет вне словаря — объект не отдаётся целиком, подписанный токен остаётся", async () => {
    serve({ ...VERDICT, inline_guidance: { ...VERDICT.inline_guidance, payment: "escalate" } });
    const inst = new TracioInstance({ publicKey: "tracio_pk_inline_bad", timeoutMs: 500 });
    const result = await inst.getResult();

    // Половинчатый объект под типом «полный» дал бы undefined там, где
    // вызывающий читает решение по сценарию.
    expect(result.inlineGuidance).toBeUndefined();
    expect(result.inlineToken).toBe("tracio_vt1.payload.sig");
  });

  it("вердикт без признака неполноты читается как неполный", async () => {
    const { inline_partial: _omit, ...noFlag } = VERDICT;
    serve(noFlag);
    const inst = new TracioInstance({ publicKey: "tracio_pk_inline_noflag", timeoutMs: 500 });
    const result = await inst.getResult();

    expect(result.inlinePartial).toBe(true);
  });
});
