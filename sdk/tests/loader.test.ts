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
