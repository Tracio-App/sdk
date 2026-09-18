import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isTracioError, TracioError } from "../src/errors.js";
import { injectScript, loadAndFetch, waitForGlobal } from "../src/loader.js";

describe("loader", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
  });

  afterEach(() => {
    document.head.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Tracio;
  });

  describe("injectScript", () => {
    it("создаёт <script data-tracio-key=…> ровно один раз", () => {
      const url = "https://edge.tracio.test/s.js?k=tracio_pk_a";
      const key = "tracio_pk_a";
      injectScript(url, key);
      injectScript(url, key);
      const scripts = document.querySelectorAll("script[data-tracio-key]");
      expect(scripts.length).toBe(1);
      expect(scripts[0]?.getAttribute("data-tracio-key")).toBe(key);
      expect(scripts[0]?.getAttribute("src")).toBe(url);
    });

    it("fields уходят атрибутом data-tracio-fields на созданный тег — тем же каналом, что ручной тег", () => {
      const url = "https://edge.tracio.test/s.js?k=tracio_pk_f";
      const el = injectScript(url, "tracio_pk_f", { email: "user@example.com", plan: "pro" });
      // Bootstrap /s.js читает атрибут с document.currentScript — этого элемента —
      // и делает JSON.parse сам, поэтому значение обязано быть валидным JSON.
      const attr = el.getAttribute("data-tracio-fields");
      expect(attr).not.toBeNull();
      expect(JSON.parse(attr as string)).toEqual({ email: "user@example.com", plan: "pro" });
    });

    it("пустая карта и отсутствие fields дают тег БЕЗ атрибута — как у интеграции без полей", () => {
      const a = injectScript("https://edge.tracio.test/s.js?k=tracio_pk_e1", "tracio_pk_e1", {});
      const b = injectScript("https://edge.tracio.test/s.js?k=tracio_pk_e2", "tracio_pk_e2");
      expect(a.hasAttribute("data-tracio-fields")).toBe(false);
      expect(b.hasAttribute("data-tracio-fields")).toBe(false);
    });

    it("на уже существующий тег атрибут не дописывается: bootstrap его уже прочитал", () => {
      const pre = document.createElement("script");
      pre.dataset["tracioKey"] = "tracio_pk_pre";
      document.head.appendChild(pre);
      const el = injectScript("about:blank", "tracio_pk_pre", { late: "1" });
      expect(el).toBe(pre);
      expect(el.hasAttribute("data-tracio-fields")).toBe(false);
    });
  });

  describe("waitForGlobal", () => {
    it("resolves когда window.Tracio появляется", async () => {
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).Tracio = { load: () => ({ get: () => Promise.resolve({}) }) };
      }, 30);
      const handle = await waitForGlobal(500);
      expect(handle.load).toBeTypeOf("function");
    });

    it("rejects с code='blocked' если не появилось до timeout", async () => {
      await expect(waitForGlobal(50)).rejects.toSatisfy((e) => {
        return isTracioError(e) && e.code === "blocked";
      });
    });
  });

  describe("loadAndFetch", () => {
    it("e2e: инжект → wait → get → нормализация в TracioResult", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () =>
          Promise.resolve({
            get: () =>
              Promise.resolve({
                canonical_uid: "vid-1",
                verdict: "bot",
                confidence: 0.9,
                markers: ["headless"],
              }),
          }),
      };
      const result = await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_x",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: false,
      });
      expect(result.visitorId).toBe("vid-1");
      expect(result.bot.detected).toBe(true);
      expect(result.bot.confidence).toBe(90);
      expect(result.bot.reasons).toEqual(["headless"]);
    });

    it("предпочитает visitorId, а не canonical_uid, когда пришли оба", async () => {
      // Регрессия: раньше порядок был обратным, и наружу уходил canonical_uid —
      // клиентский UUID слоя персиста. Поиск по нему в кабинете и в Data API
      // давал 404, причём подсказки не было: оба значения — непрозрачные строки.
      // Edge отдаёт visitorId как стабильный идентификатор визитера
      // (back/edge/internal/serve/collect.go), его и обязан вернуть SDK.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () =>
          Promise.resolve({
            get: () =>
              Promise.resolve({
                visitorId: "vid-stable",
                canonical_uid: "550e8400-e29b-41d4-a716-446655440000",
                verdict: "human",
                confidence: 0.1,
              }),
          }),
      };
      const result = await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_x",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: false,
      });
      expect(result.visitorId).toBe("vid-stable");
    });

    it("откатывается на canonical_uid, если visitorId не пришёл", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () =>
          Promise.resolve({
            get: () => Promise.resolve({ canonical_uid: "only-canonical" }),
          }),
      };
      const result = await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_x",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: false,
      });
      expect(result.visitorId).toBe("only-canonical");
    });

    it("использует scriptUrl override когда задан", async () => {
      const customUrl = "https://cdn.example.com/custom.js";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () =>
          Promise.resolve({
            get: () =>
              Promise.resolve({
                canonical_uid: "x",
                verdict: "human",
                confidence: 0,
              }),
          }),
      };
      await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_x",
        scriptUrl: customUrl,
        timeoutMs: 500,
        debug: false,
      });
      const script = document.querySelector("script[data-tracio-key]");
      expect(script?.getAttribute("src")).toBe(customUrl);
    });

    it("частичный/отсутствующий bot нормализуется в дефолты (не TypeError)", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () =>
          Promise.resolve({
            // verdict/confidence/markers отсутствуют целиком
            get: () => Promise.resolve({ canonical_uid: "vid-partial" }),
          }),
      };
      const result = await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_partial",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: false,
      });
      expect(result.visitorId).toBe("vid-partial");
      expect(result.bot).toEqual({ detected: false, confidence: 0 });
      expect(result.bot.reasons).toBeUndefined();
    });

    it("bot с частичными полями нормализуется (missing confidence → 0, reasons не массив → undefined)", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () =>
          Promise.resolve({
            get: () =>
              Promise.resolve({
                canonical_uid: "vid-p2",
                verdict: "bot",
                // confidence отсутствует → 0; markers не массив → reasons undefined
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                markers: "not-an-array" as any,
              }),
          }),
      };
      const result = await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_p2",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: false,
      });
      expect(result.bot.detected).toBe(true);
      expect(result.bot.confidence).toBe(0);
      expect(result.bot.reasons).toBeUndefined();
    });

    it("прокидывает linkedId/tag в query при отсутствии scriptUrl", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () =>
          Promise.resolve({
            get: () =>
              Promise.resolve({
                canonical_uid: "v",
                verdict: "human",
                confidence: 0,
              }),
          }),
      };
      await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_lt",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: false,
        linkedId: "acc 7",
        tag: "login",
      });
      const script = document.querySelector("script[data-tracio-key]");
      const src = script?.getAttribute("src") ?? "";
      expect(src).toContain("lid=acc%207");
      expect(src).toContain("tag=login");
    });

    it("пробрасывает lid_type/lid_sig подписанного linkedId в URL", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () => ({ get: () => Promise.resolve({ visitorId: "v-signed" }) }),
      };
      await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_sig",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: false,
        linkedId: "user@example.com",
        linkedIdType: "email",
        linkedIdSig: "ab".repeat(32),
      });
      const script = document.querySelector("script[data-tracio-key='tracio_pk_sig']");
      const src = script?.getAttribute("src") ?? "";
      expect(src).toContain("lid=user%40example.com");
      expect(src).toContain("lid_type=email");
      expect(src).toContain(`lid_sig=${"ab".repeat(32)}`);
    });

    it("подпись без типа уходит в URL: lid_sig есть, lid_type нет", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () => ({ get: () => Promise.resolve({ visitorId: "v-opaque" }) }),
      };
      await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_sig_opaque",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: false,
        linkedId: "acct-42",
        linkedIdSig: "ef".repeat(32),
      });
      const script = document.querySelector("script[data-tracio-key='tracio_pk_sig_opaque']");
      const src = script?.getAttribute("src") ?? "";
      expect(src).toContain("lid=acct-42");
      expect(src).toContain(`lid_sig=${"ef".repeat(32)}`);
      expect(src).not.toContain("lid_type=");
    });

    it("без linkedId параметры lid_type/lid_sig не уходят", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () => ({ get: () => Promise.resolve({ visitorId: "v-unsigned" }) }),
      };
      await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_nosig",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: false,
        linkedIdType: "email",
        linkedIdSig: "cd".repeat(32),
      });
      const script = document.querySelector("script[data-tracio-key='tracio_pk_nosig']");
      const src = script?.getAttribute("src") ?? "";
      expect(src).not.toContain("lid_type=");
      expect(src).not.toContain("lid_sig=");
    });

    it("rejects 'server' если get() кидает", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () => ({
          get: () => Promise.reject(new Error("502 bad gateway")),
        }),
      };
      const promise = loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_y",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: false,
      });
      await expect(promise).rejects.toBeInstanceOf(TracioError);
      await expect(promise).rejects.toMatchObject({ code: "server" });
    });

    it("debug=true: console.log вызывается при инжекте скрипта", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).Tracio = {
        load: () =>
          Promise.resolve({
            get: () =>
              Promise.resolve({
                canonical_uid: "vid-dbg",
                verdict: "human",
                confidence: 0,
              }),
          }),
      };
      await loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_dbg",
        scriptUrl: undefined,
        timeoutMs: 500,
        debug: true,
      });
      expect(logSpy).toHaveBeenCalledWith(
        "[tracio] injecting",
        expect.stringContaining("tracio_pk_dbg"),
      );
      logSpy.mockRestore();
    });

    it("rejects 'load_failed' на script onerror", async () => {
      // Pre-insert the script element so happy-dom never initiates a network fetch.
      // injectScript() finds the existing element via data-tracio-key selector and returns it,
      // then loadAndFetch attaches its onerror listener to it.
      const preScript = document.createElement("script");
      preScript.dataset["tracioKey"] = "tracio_pk_z";
      // Use a non-network src so happy-dom never tries to fetch
      preScript.setAttribute("src", "about:blank");
      document.head.appendChild(preScript);

      const promise = loadAndFetch({
        endpoint: "https://edge.tracio.test",
        publicKey: "tracio_pk_z",
        scriptUrl: "about:blank", // matches the pre-inserted element
        timeoutMs: 1000,
        debug: false,
      });

      // Dispatch error synchronously — listener is already attached
      const script = document.querySelector<HTMLScriptElement>(
        `script[data-tracio-key="tracio_pk_z"]`,
      );
      script?.dispatchEvent(new Event("error"));

      await expect(promise).rejects.toMatchObject({ code: "load_failed" });
    });
  });
});
