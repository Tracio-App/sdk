/**
 * Region shorthand. Resolves to an edge endpoint internally
 * (e.g. `us` → `https://edge.us.tracio.ai`). For self-host / proxy
 * use the `endpoint` escape hatch instead.
 */
export type TracioRegion = "us" | "eu";

export interface TracioConfig {
  /** Public API key (copy from the dashboard → API Keys). Required. */
  publicKey: string;
  /**
   * Region shorthand that resolves to an edge endpoint internally.
   * Ignored when `endpoint` is provided (explicit URL wins).
   */
  region?: TracioRegion;
  /** Base URL of the edge server. Defaults to `https://edge.tracio.ai`. */
  endpoint?: string;
  /** Full override URL for `<script src=…>`. Escape hatch for SRI / self-host. */
  scriptUrl?: string;
  /**
   * Your internal account/user id for the currently signed-in user. Forwarded
   * to the edge (`?lid=`) and used to link accounts that share a device —
   * powers the dashboard's Connections page. Only for authenticated users
   * (never `guest`/empty). Use a stable internal id (not an email), ≤256
   * bytes. Omit for anonymous visitors.
   */
  linkedId?: string;
  /**
   * What `linkedId` holds: `email`, `phone`, or `opaque` (an internal id —
   * also the default when omitted). This decides only whether the id can join
   * the cross-customer identity graph, which needs a canonical email or phone;
   * it is **not** a prerequisite for `linkedIdSig`. Requires `linkedId`.
   */
  linkedIdType?: "email" | "phone" | "opaque";
  /**
   * Server-computed signature of the RAW `linkedId`:
   * `lowercase_hex(HMAC_SHA256(lid_secret, linkedId))`. The secret lives in
   * the dashboard (Settings → Identity) and must never reach the browser —
   * compute the signature server-side and pass it down with the page. Sign
   * every id you send, whatever its type: an unsigned id can be forged by the
   * visitor. Requires `linkedId`.
   */
  linkedIdSig?: string;
  /**
   * Free-form label attached to the identification request (e.g. `checkout`,
   * `login`). Additive — edge may currently ignore it.
   */
  tag?: string;
  /**
   * Custom fields attached to every event of this page load — a flat
   * string → string map (e.g. `{ email: "user@example.com", plan: "pro" }`).
   * Forwarded as the `data-tracio-fields` attribute on the injected `<script>`,
   * exactly the channel a hand-written tag uses; the edge sanitises values
   * per field and records the visit regardless. Limits and the server-side
   * route for values that arrive after render live in one place — README,
   * "Custom fields", and the Data API reference ("Attaching fields after the
   * fact") — and are not repeated here on purpose.
   */
  fields?: Record<string, string>;
  /** When `true`, logs the script lifecycle and network activity to the console. Defaults to `false`. */
  debug?: boolean;
  /** Timeout for the full `getResult()`. Defaults to 15000 ms — fingerprint
   * collection can be slow on constrained devices/networks; bump higher if you
   * see `timeout` errors, lower for a stricter budget. */
  timeoutMs?: number;
}

/**
 * Every optional field of {@link TracioConfig}. `publicKey` is excluded: it is
 * required, so a wrapper physically cannot compile without accepting it.
 */
export type TracioConfigOptionalKeys = Exclude<keyof TracioConfig, "publicKey">;

/**
 * Runtime reflection of the {@link TracioConfig} surface.
 *
 * Types are erased at runtime, so tests that need to walk "every config field"
 * would otherwise hardcode a list — and a hardcoded list silently rots exactly
 * the way the React wrapper's field enumeration did. This constant is the one
 * place the list lives, and the assertion below keeps it honest.
 *
 * Lives in `src`, not in tests, on purpose: the test folders are excluded from
 * `tsconfig`, so a type-level assertion placed there is never checked by
 * anything and gives false confidence.
 */
export const TRACIO_CONFIG_KEYS = [
  "publicKey",
  "region",
  "endpoint",
  "scriptUrl",
  "linkedId",
  "linkedIdType",
  "linkedIdSig",
  "tag",
  "fields",
  "debug",
  "timeoutMs",
] as const;

/**
 * Two-way lock between {@link TracioConfig} and {@link TRACIO_CONFIG_KEYS}:
 * a key listed but absent from the interface, or present in the interface but
 * not listed, stops this file from compiling.
 */
type _MissingFromList = Exclude<keyof TracioConfig, (typeof TRACIO_CONFIG_KEYS)[number]>;
type _ExtraInList = Exclude<(typeof TRACIO_CONFIG_KEYS)[number], keyof TracioConfig>;

const _configKeysAreComplete: [_MissingFromList] extends [never]
  ? [_ExtraInList] extends [never]
    ? true
    : {
        readonly __error: "TRACIO_CONFIG_KEYS lists a key that TracioConfig does not have";
        readonly extra: _ExtraInList;
      }
  : {
      readonly __error: "TRACIO_CONFIG_KEYS is missing TracioConfig fields";
      readonly missing: _MissingFromList;
    } = true;
void _configKeysAreComplete;

/**
 * Compile-time guard for framework wrappers that expose config as FLAT PROPS
 * instead of forwarding the object whole.
 *
 * Why it exists. `@tracio/react` rebuilt the config field by field (deliberately
 * — so the effect depends on primitives and an inline `config={{…}}` object does
 * not re-init the SDK every render). When `linkedId` was added to the core two
 * weeks later, the wrapper was never updated. Nothing failed: no compile error,
 * no runtime warning, events kept flowing — account linking simply never worked.
 * It shipped that way in 0.1.1–0.1.3 and stayed broken for seven weeks. Later
 * `tag` and `region` fell into the same hole.
 *
 * Usage — assign `true` to a variable of this type in the wrapper's own source,
 * so `pnpm typecheck` and `pnpm build` both fail, not just the tests:
 *
 * ```ts
 * const _configCoverage: AssertWrapperCoversConfig<TracioProviderProps> = true;
 * void _configCoverage;
 * ```
 *
 * When a field is missing the assignment stops compiling, and the error text
 * names the missing keys.
 *
 * This checks the SURFACE only — that the wrapper *accepts* every field. That a
 * field is also *forwarded* is covered at runtime by `expectConfigPassthrough`
 * in `@tracio/internal-test-utils`: the two guards are complementary and both
 * are needed.
 */
export type AssertWrapperCoversConfig<Props> = [
  Exclude<TracioConfigOptionalKeys, keyof Props>,
] extends [never]
  ? true
  : {
      readonly __error: "The wrapper does not accept every TracioConfig field — missing ones never reach the core, silently";
      readonly missingKeys: Exclude<TracioConfigOptionalKeys, keyof Props>;
    };

export interface TracioBotInfo {
  detected: boolean;
  /** 0–100 (float, aligned with RiskScore). */
  confidence: number;
  reasons?: string[];
}

export interface TracioResult {
  visitorId: string;
  bot: TracioBotInfo;
}
