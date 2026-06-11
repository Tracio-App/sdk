import { TracioError } from "./errors.js";
import type { TracioBotInfo, TracioResult } from "./types.js";

interface RawTracioResponse {
  visitor_id?: string;
  request_id?: string;
  bot?: { detected?: boolean; confidence?: number; reasons?: string[] };
}

interface TracioGlobal {
  load: () => { get: () => Promise<RawTracioResponse> };
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
 * Defensively normalise an untrusted wire-shape `bot` object into a fully
 * populated TracioBotInfo. A missing/partial `bot` must not surface as a
 * catch-all `server` TypeError — we coerce to safe defaults instead.
 */
function normalizeBot(bot: RawTracioResponse["bot"]): TracioBotInfo {
  const reasons = Array.isArray(bot?.reasons) ? bot.reasons : undefined;
  return {
    detected: bot?.detected === true,
    confidence: typeof bot?.confidence === "number" ? bot.confidence : 0,
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
    raw = await tracioGlobal.load().get();
  } catch (cause) {
    throw new TracioError("server", `edge response error: ${String(cause)}`);
  }

  return {
    visitorId: raw.visitor_id ?? "",
    requestId: raw.request_id ?? "",
    bot: normalizeBot(raw.bot),
  };
}
