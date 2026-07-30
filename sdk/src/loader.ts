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
   * Same source: `"visitorId": respVisitorID, // первый Visitor ID`.
   */
  visitorId?: string;
  /** Bot decision in the canonical `{ bot | human | uncertain }` taxonomy. */
  verdict?: string;
  /** Confidence in the verdict on a 0–1 scale. */
  confidence?: number;
  /** Signal markers that drove the verdict (e.g. `automation_globals`). */
  markers?: string[];
}

interface TracioApi {
  get: () => Promise<RawTracioResponse>;
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

export function injectScript(url: string, publicKey: string): HTMLScriptElement {
  const selector = `script[data-tracio-key="${publicKey}"]`;
  const existing = document.querySelector<HTMLScriptElement>(selector);
  if (existing) return existing;

  const script = document.createElement("script");
  script.src = url;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset["tracioKey"] = publicKey;
  document.head.appendChild(script);
  return script;
}

export function waitForGlobal(timeoutMs: number): Promise<TracioGlobal> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const win = window as WindowWithTracio;
    if (win.Tracio) {
      resolve(win.Tracio);
      return;
    }
    const interval = setInterval(() => {
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
  tag?: string | undefined;
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
  const { endpoint, publicKey, scriptUrl, timeoutMs, debug, linkedId, tag } = args;
  const base = `${endpoint.replace(/\/$/, "")}/s.js?k=${encodeURIComponent(publicKey)}`;
  const params: string[] = [];
  if (linkedId) params.push(`lid=${encodeURIComponent(linkedId)}`);
  if (tag) params.push(`tag=${encodeURIComponent(tag)}`);
  const url = scriptUrl ?? (params.length ? `${base}&${params.join("&")}` : base);

  if (debug) console.log("[tracio] injecting", url);

  const script = injectScript(url, publicKey);

  const loadError = new Promise<never>((_, reject) => {
    script.addEventListener("error", () => {
      reject(new TracioError("load_failed", "<script> onerror — network/CSP/CORS failure"));
    });
  });
  // Prevent unhandled-rejection when waitForGlobal wins the race and
  // loadError is settled later (e.g. a late onerror event).
  loadError.catch(() => undefined);

  const tracioGlobal = await Promise.race([waitForGlobal(timeoutMs), loadError]);

  let raw: RawTracioResponse;
  try {
    // `load()` may return the API or a promise of it — await covers both. The
    // live edge resolves it only once its second bundle is ready.
    const api = await tracioGlobal.load();
    if (!api || typeof api.get !== "function") {
      throw new Error("load() did not return a fetchable API");
    }
    raw = await api.get();
  } catch (cause) {
    throw new TracioError("server", `edge response error: ${String(cause)}`);
  }

  return {
    // `visitorId` FIRST: it is the id the dashboard shows and the Data API
    // accepts. The previous order preferred `canonical_uid`, so integrators got
    // the client-side persistence UUID instead — every lookup by that value
    // returned 404, with nothing to hint why (both are opaque strings).
    visitorId: raw.visitorId ?? raw.canonical_uid ?? "",
    bot: normalizeBot(raw),
  };
}
