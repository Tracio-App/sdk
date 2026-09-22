import { TracioError } from "./errors.js";
import type { TracioBotInfo, TracioResult } from "./types.js";

/**
 * Wire shape of the edge collect response (`window.Tracio.load().get()`).
 * Field names mirror the LIVE edge contract verbatim — this is not a
 * normalised shape. All fields optional: the edge response is untrusted input.
 */
interface RawTracioResponse {
  /**
   * Client-side persistence UUID (v4). Used internally by the browser storage
   * layers — NOT the id shown in the dashboard and NOT accepted by the Data
   * API. Kept only as a last-resort fallback.
   *
   * See `back/edge/internal/serve/collect.go`, where the response is built:
   * `"canonical_uid": canonicalUid, // UUID v4 client UID`.
   */
  canonical_uid?: string;
  /**
   * The visitor id. Stable across sessions, shown in the dashboard and accepted
   * by the Data API — this is what integrators must use for lookups.
   *
   * Same source: `"visitorId": respVisitorID, // the first Visitor ID`.
   */
  visitorId?: string;
  /** Bot decision in the canonical `{ bot | human | uncertain }` taxonomy. */
  verdict?: string;
  /** Confidence in the verdict on a 0–1 scale. */
  confidence?: number;
  /** Signal markers that drove the verdict (e.g. `automation_globals`). */
  markers?: string[];
}

/**
 * Options of the runtime's `get()`. `fields` is the custom-fields map: passed
 * as a function argument it lives in the runtime's memory only — never in the
 * page markup, the script URL or a `window` global, where every other script
 * on the page could read it. The runtime copies it at call time.
 */
interface TracioGetOptions {
  fields?: Record<string, unknown>;
}

interface TracioApi {
  get: (opts?: TracioGetOptions) => Promise<RawTracioResponse>;
}

/**
 * The edge runtime's `window.Tracio`. `load()` may return the API synchronously
 * (older bundles / test doubles) or a promise of it (the live edge bootstraps a
 * second script and resolves once it's ready) — callers must `await` it.
 */
interface TracioGlobal {
  load: () => TracioApi | Promise<TracioApi>;
}

interface WindowWithTracio {
  Tracio?: TracioGlobal;
}

/**
 * Find our edge <script> by key, without going through a CSS selector.
 *
 * A selector has to be built as a string, and a key containing a quote or a
 * backslash then either throws a raw DOMException out of querySelector or —
 * even escaped — fails to match in some DOM implementations, which breaks the
 * dedupe silently and leaves two tags on the page. Scanning document.scripts
 * compares the attribute VALUE and has neither failure mode.
 *
 * `ownedOnly` restricts the search to tags this SDK created: a hand-written tag
 * on the page carries the integrator's own data-tracio-fields, and removing it
 * to fix our own retry would break their integration.
 */
export function findTag(publicKey: string, ownedOnly = false): HTMLScriptElement | undefined {
  for (const el of Array.from(document.scripts)) {
    if (el.dataset["tracioKey"] !== publicKey) continue;
    if (ownedOnly && el.dataset["tracioOwned"] !== "1") continue;
    return el;
  }
  return undefined;
}

export function injectScript(
  url: string,
  publicKey: string,
  fields?: Record<string, unknown>,
): HTMLScriptElement {
  const existing = findTag(publicKey);
  if (existing) {
    // Fields go to the runtime through `get()` (loadAndFetch), which is called
    // on whatever runtime this tag has already started — and that runtime may
    // have finished collecting: its first wave went out at load, its late wave
    // on the first hide or after its own window. Fields handed over after that
    // have nothing left to ride on and are silently not recorded. Only a tag
    // we did NOT write can be in that state here (our own is removed by
    // destroy()), so say it once, where the integrator can see it.
    if (fields && Object.keys(fields).length > 0 && existing.dataset["tracioOwned"] !== "1") {
      console.warn(
        "[tracio] a hand-written tag for this key is on the page; fields reach its runtime " +
          "only while it is still collecting. Remove the tag before init.",
      );
    }
    return existing;
  }

  const script = document.createElement("script");
  script.src = url;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset["tracioKey"] = publicKey;
  // Marks the tag as ours: a retry may remove it, and removing a hand-written
  // tag (or a tag another integration owns) would take their fields with it.
  script.dataset["tracioOwned"] = "1";
  // No `data-tracio-fields` here, ever. Custom fields go to the runtime as an
  // argument of `get()` (loadAndFetch below): an attribute sits in the page
  // markup for the life of the page, and the bootstrap copied it into a
  // `window` global on top — readable by every analytics tag, A/B tool and
  // session-replay recorder on the page. Integrators put an email in there.
  // The tag the SDK writes carries only the key and the ownership marker.
  document.head.appendChild(script);
  return script;
}

export function waitForGlobal(
  timeoutMs: number,
  /**
   * Set `aborted` once the caller stops caring. Without it the 50 ms poll keeps
   * running for the whole budget whenever something ELSE wins the race (a
   * script `error`, or destroy()) — and a retry then adds a second live poll.
   */
  signal?: { aborted: boolean },
): Promise<TracioGlobal> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const win = window as WindowWithTracio;
    if (win.Tracio) {
      resolve(win.Tracio);
      return;
    }
    const interval = setInterval(() => {
      if (signal?.aborted) {
        clearInterval(interval);
        return;
      }
      if (win.Tracio) {
        clearInterval(interval);
        resolve(win.Tracio);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        reject(
          new TracioError(
            "blocked",
            `window.Tracio did not appear within ${timeoutMs}ms (an adblocker or CSP is likely blocking the script)`,
          ),
        );
      }
    }, 50);
  });
}

export interface LoadAndFetchArgs {
  endpoint: string;
  publicKey: string;
  scriptUrl: string | undefined;
  timeoutMs: number;
  debug: boolean;
  linkedId?: string | undefined;
  linkedIdType?: "email" | "phone" | "opaque" | undefined;
  linkedIdSig?: string | undefined;
  tag?: string | undefined;
  fields?: Record<string, unknown> | undefined;
}

/**
 * Map the edge's flat bot signals into TracioBotInfo. `verdict === "bot"` drives
 * `detected`; `confidence` is rescaled 0–1 → 0–100 (aligned with RiskScore) and
 * clamped; `markers` become `reasons`. Missing/partial fields coerce to safe
 * defaults rather than surfacing as a catch-all `server` TypeError.
 */
function normalizeBot(raw: RawTracioResponse): TracioBotInfo {
  const reasons = Array.isArray(raw.markers) ? raw.markers : undefined;
  const conf = typeof raw.confidence === "number" ? raw.confidence : 0;
  return {
    detected: raw.verdict === "bot",
    confidence: Math.max(0, Math.min(100, conf * 100)),
    ...(reasons ? { reasons } : {}),
  };
}

export async function loadAndFetch(args: LoadAndFetchArgs): Promise<TracioResult> {
  const {
    endpoint,
    publicKey,
    scriptUrl,
    timeoutMs,
    debug,
    linkedId,
    linkedIdType,
    linkedIdSig,
    tag,
    fields,
  } = args;
  const base = `${endpoint.replace(/\/$/, "")}/s.js?k=${encodeURIComponent(publicKey)}`;
  const params: string[] = [];
  if (linkedId) params.push(`lid=${encodeURIComponent(linkedId)}`);
  // Signed trust level: the signature is computed server-side over the RAW
  // linkedId (before URL-encoding) — the SDK only transports it.
  if (linkedId && linkedIdType) params.push(`lid_type=${encodeURIComponent(linkedIdType)}`);
  if (linkedId && linkedIdSig) params.push(`lid_sig=${encodeURIComponent(linkedIdSig)}`);
  if (tag) params.push(`tag=${encodeURIComponent(tag)}`);
  const url = scriptUrl ?? (params.length ? `${base}&${params.join("&")}` : base);

  if (debug) {
    // lid is the integrator's raw account id (often an email) and lid_sig is the
    // only thing standing between it and forgery — neither belongs in a console
    // breadcrumb picked up by Sentry/LogRocket/Datadog RUM.
    console.log("[tracio] injecting", url.replace(/([?&](?:lid|lid_sig)=)[^&]*/g, "$1<redacted>"));
  }

  const script = injectScript(url, publicKey, fields);

  const loadError = new Promise<never>((_, reject) => {
    script.addEventListener("error", () => {
      reject(new TracioError("load_failed", "<script> onerror — network/CSP/CORS failure"));
    });
  });
  // Prevent unhandled-rejection when waitForGlobal wins the race and
  // loadError is settled later (e.g. a late onerror event).
  loadError.catch(() => undefined);

  const pollSignal = { aborted: false };
  let tracioGlobal: TracioGlobal;
  try {
    tracioGlobal = await Promise.race([waitForGlobal(timeoutMs, pollSignal), loadError]);
  } finally {
    pollSignal.aborted = true;
  }

  let raw: RawTracioResponse;
  try {
    // `load()` may return the API or a promise of it — await covers both. The
    // live edge resolves it only once its second bundle is ready.
    const api = await tracioGlobal.load();
    if (!api || typeof api.get !== "function") {
      throw new Error("load() did not return a fetchable API");
    }
    // Fields travel HERE, as an argument, and nowhere else — see injectScript.
    // The runtime copies them and mixes them into every collect wave it still
    // has ahead; a hand-written tag that already carries `data-tracio-fields`
    // keeps its owner's map on the tag, but the runtime prefers this argument.
    // A runtime that predates the option ignores the argument (fields not sent).
    raw = await api.get(fields && Object.keys(fields).length > 0 ? { fields } : undefined);
  } catch (cause) {
    throw new TracioError("server", `edge response error: ${String(cause)}`);
  }

  // `visitorId` FIRST: it is the id the dashboard shows and the Data API
  // accepts. The previous order preferred `canonical_uid`, so integrators got
  // the client-side persistence UUID instead — every lookup by that value
  // returned 404, with nothing to hint why (both are opaque strings).
  //
  // `??` only guards null/undefined, so an empty string used to sail through as
  // a successful result: the caller got `{visitorId: "", bot: {detected: false}}`
  // and a fraud gate reading `if (!bot.detected) allow()` opened fail-open on a
  // collection failure. The edge really can answer without identity — a retried
  // primary POST on a finished session returns `{"ok": true}` alone.
  const visitorId = raw.visitorId || raw.canonical_uid || "";
  if (!visitorId) {
    throw new TracioError("server", "edge response carried no visitor id");
  }

  return {
    visitorId,
    bot: normalizeBot(raw),
  };
}
