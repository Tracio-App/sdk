import { test, expect } from "@playwright/test";

// Real-browser (Chromium) smoke against the BUILT artifacts in dist/. happy-dom
// unit tests never fetch or run injected scripts, so the loader's actual
// behaviour — document.createElement('script') + head.appendChild + poll
// window.Tracio, the onerror branch, and the IIFE CDN global — is only
// exercised here. (SDK audit P1-1.)

const STUB = "/e2e/fixtures/stub-s.js";

test.describe("CDN / IIFE bundle (dist/index.min.js)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/e2e/fixtures/iife.html");
    // The IIFE is a blocking <script>, but guard against any load race before
    // we touch the global.
    await page.waitForFunction(
      () => typeof (window as Record<string, any>)["TracioSDK"] === "object",
    );
  });

  test("exposes the TracioSDK namespace and resolves getResult()", async ({ page }) => {
    expect(
      await page.evaluate(() => typeof (window as Record<string, any>)["TracioSDK"].Tracio.init),
    ).toBe("function");

    const result = await page.evaluate(
      async ({ key, stub }) => {
        const TracioSDK = (window as Record<string, any>)["TracioSDK"];
        const t = TracioSDK.Tracio.init({ publicKey: key, scriptUrl: stub, timeoutMs: 3000 });
        return t.getResult();
      },
      { key: "tracio_pk_iife", stub: STUB },
    );

    expect(result).toMatchObject({
      visitorId: "e2e-visitor",
      bot: { detected: false, confidence: 12 },
    });
  });

  test("dedupes the injected edge <script> by data-tracio-key", async ({ page }) => {
    const key = "tracio_pk_dedupe";
    await page.evaluate(
      async ({ key, stub }) => {
        const Tracio = (window as Record<string, any>)["TracioSDK"].Tracio;
        Tracio.init({ publicKey: key, scriptUrl: stub, timeoutMs: 3000 });
        // Same key again returns the cached instance — must NOT inject twice.
        await Tracio.init({ publicKey: key, scriptUrl: stub, timeoutMs: 3000 }).getResult();
      },
      { key, stub: STUB },
    );

    const count = await page.evaluate(
      (key) => document.querySelectorAll(`script[data-tracio-key="${key}"]`).length,
      key,
    );
    expect(count).toBe(1);
  });

  test("rejects a retryable TracioError when the edge script loads but never defines window.Tracio", async ({
    page,
  }) => {
    // The script 200s but never sets window.Tracio. The instance-level timeout
    // (timeoutMs) and waitForGlobal's blocked-detection share the SAME budget and
    // race; the setTimeout usually beats the polling check, so the public-surface
    // outcome is `timeout` OR `blocked` — both are retryable. We assert the
    // contract that matters: a hung edge does NOT hang the caller, it rejects with
    // a typed, retryable TracioError. (Isolating `blocked` deterministically isn't
    // possible through the public API while the budgets are shared.)
    const err = await page.evaluate(async (key) => {
      try {
        await (window as Record<string, any>)["TracioSDK"].Tracio.init({
          publicKey: key,
          scriptUrl: "/e2e/fixtures/stub-hang.js",
          timeoutMs: 400,
        }).getResult();
        return { code: null as string | null, name: null as string | null, retryable: false };
      } catch (e) {
        const te = e as { code?: string; name?: string; retryable?: boolean };
        return { code: te.code ?? null, name: te.name ?? null, retryable: te.retryable ?? false };
      }
    }, "tracio_pk_blocked");

    expect(err.name).toBe("TracioError");
    expect(["blocked", "timeout"]).toContain(err.code);
    expect(err.retryable).toBe(true);
  });

  test("rejects TracioError('load_failed') on a 404 edge script", async ({ page }) => {
    const err = await page.evaluate(async (key) => {
      try {
        await (window as Record<string, any>)["TracioSDK"].Tracio.init({
          publicKey: key,
          scriptUrl: "/e2e/fixtures/does-not-exist.js",
          timeoutMs: 2000,
        }).getResult();
        return { code: null as string | null, name: null as string | null };
      } catch (e) {
        const te = e as { code?: string; name?: string };
        return { code: te.code ?? null, name: te.name ?? null };
      }
    }, "tracio_pk_404");

    expect(err).toMatchObject({ name: "TracioError", code: "load_failed" });
  });
});

test("ESM bundle (dist/index.js) resolves getResult() via <script type=module>", async ({
  page,
}) => {
  await page.goto("/e2e/fixtures/esm.html");
  await page.waitForFunction(() => (window as Record<string, any>)["__esmReady"] === true);

  const result = await page.evaluate(
    async ({ key, stub }) =>
      (window as Record<string, any>)["runInit"]({
        publicKey: key,
        scriptUrl: stub,
        timeoutMs: 3000,
      }),
    { key: "tracio_pk_esm", stub: STUB },
  );

  expect(result).toMatchObject({ visitorId: "e2e-visitor" });
});
