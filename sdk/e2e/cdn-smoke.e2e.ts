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

// The five scenarios above all pass `scriptUrl`, which replaces the whole URL —
// so the loader's own query building (endpoint + k + lid + lid_type + lid_sig +
// tag) and the custom-fields hand-off to get() were never exercised in a
// browser. A regression there is invisible to happy-dom too, where the script
// never runs.
test.describe("real URL building (no scriptUrl)", () => {
  test("puts key, account linking and tag in the query, and fields in get() — not on the tag", async ({
    page,
  }) => {
    await page.goto("/e2e/fixtures/iife.html");
    await page.waitForFunction(
      () => typeof (window as Record<string, any>)["TracioSDK"] === "object",
    );

    const out = await page.evaluate(async () => {
      const Tracio = (window as Record<string, any>)["TracioSDK"].Tracio;
      const t = Tracio.init({
        publicKey: "tracio_pk_url",
        endpoint: window.location.origin,
        linkedId: "user+42@example.com",
        linkedIdType: "email",
        linkedIdSig: "a".repeat(64),
        tag: "checkout",
        fields: { plan: "pro", order: "A-1029" },
        timeoutMs: 5000,
      });
      const result = await t.getResult();
      return {
        result,
        src: (window as Record<string, any>)["__tracioTagSrc"],
        tagFields: (window as Record<string, any>)["__tracioTagFields"],
        getFields: (window as Record<string, any>)["__tracioGetFields"],
        // The stub declares `__f` the way the live bootstrap does (always,
        // from the attribute, '' when absent): with no attribute on the tag the
        // global carries nothing.
        globalF: (window as Record<string, any>)["__f"],
        tagHasAttr: !!document
          .querySelector('script[data-tracio-key="tracio_pk_url"]')
          ?.hasAttribute("data-tracio-fields"),
      };
    });

    expect(out.result).toMatchObject({ visitorId: "e2e-visitor" });

    const url = new URL(out.src);
    expect(url.pathname).toBe("/s.js");
    expect(url.searchParams.get("k")).toBe("tracio_pk_url");
    // `+` must survive as %2B: the edge verifies the HMAC over the RAW value,
    // and a `+` decoded as a space would break every signed link.
    expect(url.searchParams.get("lid")).toBe("user+42@example.com");
    expect(url.searchParams.get("lid_type")).toBe("email");
    expect(url.searchParams.get("lid_sig")).toBe("a".repeat(64));
    expect(url.searchParams.get("tag")).toBe("checkout");

    // Both halves of the channel in one test: the fields reached the runtime
    // through get(), AND nothing was written to the page for other scripts to
    // read — no attribute on the tag (at any moment: the stub captured it while
    // executing) and no window global.
    expect(out.getFields).toEqual({ plan: "pro", order: "A-1029" });
    expect(out.tagFields).toBeNull();
    expect(out.tagHasAttr).toBe(false);
    expect(out.globalF).toBe("");
  });
});
