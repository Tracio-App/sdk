/**
 * Canonical "every field set" config for wrapper pass-through tests.
 *
 * Values are deliberately distinctive so a wrong-field mix-up is obvious in the
 * diff rather than looking like a plausible default.
 *
 * NOT typed as `Required<TracioConfig>` on purpose: this package must not depend
 * on `@tracio/sdk` (the SDK already dev-depends on this one, and the cycle
 * breaks the dts build). The completeness guarantee is not lost — it moved to
 * `packages/sdk/tests/config-fixture.test.ts`, which asserts at compile time
 * that this object covers every field of `TracioConfig`. The SDK depends on both
 * sides, so it is the natural place for that check.
 *
 * Adding a field to `TracioConfig` without adding it here fails that test.
 */
export const FULL_CONFIG = {
  publicKey: "tracio_pk_passthrough",
  region: "eu",
  endpoint: "https://edge.passthrough.test",
  scriptUrl: "https://cdn.passthrough.test/custom.js",
  linkedId: "user-passthrough-42",
  linkedIdType: "email",
  linkedIdSig: "a".repeat(64),
  tag: "checkout-passthrough",
  fields: { plan: "pro-passthrough", email: "passthrough@example.com" },
  debug: true,
  timeoutMs: 4242,
} as const;

/**
 * Assert that a framework wrapper forwarded the config to `Tracio.init`
 * unchanged.
 *
 * Why this exists alongside the compile-time `AssertWrapperCoversConfig`: the
 * type guard proves a wrapper *accepts* a field, this proves it *forwards* one.
 * A wrapper can happily declare `linkedId?: string` and then forget to put it
 * into the object it hands to the core — that is exactly what happened in
 * `@tracio/react`, and it produced no error of any kind. Only one of the two
 * guards would have caught it; both are needed.
 *
 * Returns a human-readable report instead of throwing, so the caller decides how
 * to fail (each framework's test runner has its own assertion style).
 */
export function checkConfigPassthrough(received: unknown): {
  ok: boolean;
  problems: string[];
} {
  const problems: string[] = [];

  if (received === null || typeof received !== "object") {
    return {
      ok: false,
      problems: [`Tracio.init received ${String(received)} instead of a config object`],
    };
  }

  const got = received as Record<string, unknown>;

  for (const [key, expected] of Object.entries(FULL_CONFIG)) {
    if (!(key in got)) {
      problems.push(`field "${key}" did not reach the core — the wrapper drops it`);
      continue;
    }
    // "Without loss" is about content, not object identity: React rebuilds
    // `fields` from its serialised form (see TracioProvider), and that is
    // fine — the core receives the same map. Primitives compare as before;
    // for objects, keys and their order are part of the comparison on purpose.
    const same =
      typeof expected === "object" && expected !== null
        ? JSON.stringify(got[key]) === JSON.stringify(expected)
        : got[key] === expected;
    if (!same) {
      problems.push(
        `field "${key}": expected ${JSON.stringify(expected)}, got ${JSON.stringify(got[key])}`,
      );
    }
  }

  for (const key of Object.keys(got)) {
    if (!(key in FULL_CONFIG)) {
      problems.push(`the wrapper added an unexpected field "${key}" — the core does not expect it`);
    }
  }

  return { ok: problems.length === 0, problems };
}

/** Convenience wrapper: throws with a readable message when something is off. */
export function expectConfigPassthrough(received: unknown): void {
  const { ok, problems } = checkConfigPassthrough(received);
  if (!ok) {
    throw new Error(
      "The wrapper did not forward the full config to the core:\n  - " + problems.join("\n  - "),
    );
  }
}
