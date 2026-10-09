// @vitest-environment node
import { describe, expect, it } from "vitest";
import { get } from "svelte/store";

import { Tracio, useTracio, useVisitorId } from "../src/index.js";

describe("SSR", () => {
  it("Tracio.init на сервере не падает", () => {
    expect(() => Tracio.init({ publicKey: "tracio_pk_ssr_s" })).not.toThrow();
  });

  it("useVisitorId на сервере возвращает store с isLoading=true", () => {
    // Сбор браузерный, поэтому на сервере честное состояние — «загружается».
    // Иначе серверная разметка разошлась бы с первым клиентским рендером.
    const store = useVisitorId();
    expect(get(store).isLoading).toBe(true);
    expect(get(store).data).toBeUndefined();
  });

  it("контекст НЕ протекает между запросами: init одного не виден другому", () => {
    // SvelteKit обслуживает все запросы одним процессом Node, а модульная
    // переменная живёт столько же, сколько сам модуль. Прежде init в
    // `+layout.ts` (вне компонента, ровно как учит README) клал контекст в
    // общий модульный слот, и следующий запрос читал чужой инстанс — вместе
    // с чужим linkedId и чужими полями.
    Tracio.init({ publicKey: "tracio_pk_request_a" });
    // «Запрос B»: вызов вне компонента, своего контекста нет.
    expect(useTracio()).toBeUndefined();
  });

  it("повторный init на сервере не оставляет следа для следующего запроса", () => {
    Tracio.init({ publicKey: "tracio_pk_request_c" });
    Tracio.init({ publicKey: "tracio_pk_request_d" });
    expect(useTracio()).toBeUndefined();
    // И store остаётся «загружается», а не отдаёт результат чужого запроса.
    expect(get(useVisitorId()).isLoading).toBe(true);
  });
});
