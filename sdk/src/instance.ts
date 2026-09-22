import { TracioError } from "./errors.js";
import { normalizeFields } from "./fields.js";
import { findTag, loadAndFetch } from "./loader.js";
import { isBrowser } from "./ssr.js";
import type { TracioConfig, TracioRegion, TracioResult } from "./types.js";

type ReadyListener = (result: TracioResult) => void;
type ErrorListener = (err: TracioError) => void;

const DEFAULT_ENDPOINT = "https://edge.tracio.ai";
const DEFAULT_TIMEOUT_MS = 15000;

const REGION_ENDPOINTS: Record<TracioRegion, string> = {
  us: "https://edge.us.tracio.ai",
  eu: "https://edge.eu.tracio.ai",
};

/** Resolve the effective edge endpoint: explicit `endpoint` > `region` > default. */
function resolveEndpoint(config: TracioConfig): string {
  if (config.endpoint) return config.endpoint;
  if (config.region) return REGION_ENDPOINTS[config.region];
  return DEFAULT_ENDPOINT;
}

export class TracioInstance {
  public readonly publicKey: string;
  public destroyed = false;

  private readonly endpoint: string;
  private readonly scriptUrl: string | undefined;
  private readonly linkedId: string | undefined;
  private readonly linkedIdType: "email" | "phone" | "opaque" | undefined;
  private readonly linkedIdSig: string | undefined;
  private readonly tag: string | undefined;
  private readonly fields: Record<string, unknown> | undefined;
  private readonly timeoutMs: number;
  private readonly debug: boolean;
  private resultPromise: Promise<TracioResult> | undefined;
  private cachedResult: TracioResult | undefined;
  private cachedError: TracioError | undefined;
  private readyListeners: ReadyListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private rejectDestroy: ((err: TracioError) => void) | undefined;
  private budgetTimer: ReturnType<typeof setTimeout> | undefined;
  private inFlight = false;

  constructor(config: TracioConfig) {
    if (!config.publicKey || typeof config.publicKey !== "string") {
      throw new TracioError("invalid_config", "publicKey is required and must be a string");
    }
    this.publicKey = config.publicKey;
    this.endpoint = resolveEndpoint(config);
    this.scriptUrl = config.scriptUrl;
    // A signature with no id to sign is a config bug — fail loudly instead of
    // silently degrading (the edge would ignore an unpaired parameter anyway).
    //
    // A signature WITHOUT a type is not a bug and used to be rejected here.
    // That rule answered the wrong question: the type decides which namespace
    // the id joins (cross-customer needs a canonical email or phone), while
    // the signature answers whether your server issued the id at all — and
    // that holds for an opaque internal id just as well. Rejecting the pair
    // meant an integrator who did not want to hand us an email could not sign
    // anything, so nobody signed: prod 2026-09-02..05 saw 10868 account links
    // and not one signature.
    if ((config.linkedIdType || config.linkedIdSig) && !config.linkedId) {
      throw new TracioError("invalid_config", "linkedIdType/linkedIdSig require linkedId");
    }
    if (
      config.linkedIdType &&
      config.linkedIdType !== "email" &&
      config.linkedIdType !== "phone" &&
      config.linkedIdType !== "opaque"
    ) {
      throw new TracioError("invalid_config", 'linkedIdType must be "email", "phone" or "opaque"');
    }
    this.linkedId = config.linkedId;
    this.linkedIdType = config.linkedIdType;
    this.linkedIdSig = config.linkedIdSig;
    this.tag = config.tag;
    // A bad field must never cost the visit — that is the edge's own rule
    // (fieldsvalidate.go). normalizeFields warns and copies; it never throws
    // and never silently drops a value the edge would have accepted.
    this.fields = normalizeFields(config.fields);
    // `??` lets NaN through: `Number(undefined)` is a real-world value here.
    // NaN makes setTimeout fire immediately AND makes waitForGlobal's
    // `elapsed >= timeoutMs` false forever, leaking a 50ms interval for the
    // life of the page. Fall back loudly rather than throw — see fields above.
    const timeout = config.timeoutMs;
    if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0)) {
      console.warn(
        `[tracio] timeoutMs must be a positive finite number; using ${DEFAULT_TIMEOUT_MS}ms`,
      );
    }
    this.timeoutMs =
      timeout !== undefined && Number.isFinite(timeout) && timeout > 0
        ? timeout
        : DEFAULT_TIMEOUT_MS;
    this.debug = config.debug ?? false;
  }

  async getVisitorId(): Promise<string> {
    const result = await this.getResult();
    return result.visitorId;
  }

  getResult(): Promise<TracioResult> {
    if (this.destroyed) {
      return Promise.reject(new TracioError("destroyed", "instance has been destroyed"));
    }
    if (!isBrowser()) {
      return Promise.reject(
        new TracioError("non_browser", "getResult() is browser-only; do not await on the server"),
      );
    }
    if (!this.resultPromise) {
      this.resultPromise = this.fetchOnce();
    }
    return this.resultPromise;
  }

  /**
   * Register a success listener. If the result already arrived, fires on the
   * next microtask. If a fetch already FAILED, this listener is never called —
   * use {@link onError} for the failure channel.
   */
  onReady(cb: ReadyListener): void {
    if (this.cachedResult) {
      const cached = this.cachedResult;
      queueMicrotask(() => cb(cached));
      return;
    }
    this.readyListeners.push(cb);
    this.ensureInFlight();
  }

  /**
   * Register a failure listener. If a fetch already failed, the listener is
   * notified on the next microtask of the already-happened error (so late
   * subscribers are not silently dropped).
   */
  onError(cb: ErrorListener): void {
    if (this.cachedError) {
      const cached = this.cachedError;
      queueMicrotask(() => cb(cached));
      return;
    }
    this.errorListeners.push(cb);
    this.ensureInFlight();
  }

  private ensureInFlight(): void {
    if (!isBrowser() || this.destroyed) return;
    if (!this.resultPromise) {
      // Swallow here — the rejection is delivered via onError listeners and
      // remains observable through getResult().
      this.resultPromise = this.fetchOnce();
      this.resultPromise.catch(() => undefined);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (isBrowser()) {
      const tag = findTag(this.publicKey);
      if (tag) {
        tag.remove();
        // The global the removed tag's bundle installed goes with it. Left in
        // place, a re-`init` would find it synchronously and hand its
        // `get({ fields })` to a runtime whose visit is over — the fields would
        // be dropped, or ride the OLD visit's late wave — while the tag it just
        // injected starts a second runtime that never sees them. Assignment,
        // not `delete`: the bundle declares `var Tracio`, a non-configurable
        // window property. Without a tag the global is not ours to unset.
        (window as { Tracio?: unknown }).Tracio = undefined;
      }
    }

    if (this.budgetTimer !== undefined) {
      clearTimeout(this.budgetTimer);
      this.budgetTimer = undefined;
    }

    const settlesLater = this.inFlight;
    if (this.rejectDestroy) {
      this.rejectDestroy(new TracioError("destroyed", "instance destroyed mid-fetch"));
    }

    this.readyListeners = [];
    // An in-flight fetch settles on a LATER microtask, so clearing the error
    // listeners here would silence the `destroyed` rejection they exist for —
    // the catch below drains and clears them itself.
    if (!settlesLater) this.errorListeners = [];
    this.cachedResult = undefined;
    this.cachedError = undefined;
    this.resultPromise = undefined;
  }

  private clearBudgetTimer(): void {
    if (this.budgetTimer !== undefined) {
      clearTimeout(this.budgetTimer);
      this.budgetTimer = undefined;
    }
  }

  private async fetchOnce(): Promise<TracioResult> {
    this.inFlight = true;
    const destroyPromise = new Promise<never>((_, reject) => {
      this.rejectDestroy = reject;
    });
    destroyPromise.catch(() => undefined); // suppress unhandled rejection if fetch wins

    const timeoutPromise = new Promise<never>((_, reject) => {
      this.budgetTimer = setTimeout(() => {
        reject(new TracioError("timeout", `getResult() exceeded ${this.timeoutMs}ms budget`));
      }, this.timeoutMs);
    });
    timeoutPromise.catch(() => undefined); // suppress unhandled rejection if fetch wins

    const fetchPromise = loadAndFetch({
      endpoint: this.endpoint,
      publicKey: this.publicKey,
      scriptUrl: this.scriptUrl,
      timeoutMs: this.timeoutMs,
      debug: this.debug,
      linkedId: this.linkedId,
      linkedIdType: this.linkedIdType,
      linkedIdSig: this.linkedIdSig,
      tag: this.tag,
      fields: this.fields,
    });

    let result: TracioResult;
    try {
      result = await Promise.race([fetchPromise, destroyPromise, timeoutPromise]);
    } catch (err) {
      this.inFlight = false;
      this.clearBudgetTimer();
      const error =
        err instanceof TracioError ? err : new TracioError("server", `unexpected: ${String(err)}`);

      // A rejected promise used to be cached forever, so the documented retry
      // (`if (isRetryableError(e)) getResult()`) handed back the SAME rejection
      // synchronously — a hot loop that never touched the network.
      //
      // Only TRANSIENT failures are worth another attempt. `server` is not one
      // of them here: an edge answering without identity answers that way for
      // the whole page load, and re-asking would be a hot loop WITH requests.
      // Retryability is a PUBLIC contract (`TracioError.retryable`, documented in
      // the README) — keeping a second, narrower list here would mean the docs
      // promise a retry that silently returns the same cached rejection.
      if (error.retryable) {
        // The failed <script> stays in the DOM, and injectScript short-circuits
        // on it — so without removing it the retry would silently wait out the
        // whole budget on a tag whose `error` event has already fired.
        //
        // Only ever remove a tag WE created (data-tracio-owned): a hand-written
        // tag on the page carries the integrator's own data-tracio-fields, and
        // removing it would break their integration to fix ours. And only when
        // the runtime never appeared — if window.Tracio is up, the script ran,
        // so the tag is live and dropping it would just duplicate the session.
        if (isBrowser() && !(window as { Tracio?: unknown }).Tracio) {
          findTag(this.publicKey, true)?.remove();
        }
        this.resultPromise = undefined;
      }

      this.cachedError = error;
      for (const cb of this.errorListeners.splice(0)) {
        try {
          cb(error);
        } catch (listenerErr) {
          if (this.debug) console.error("[tracio] onError listener threw", listenerErr);
        }
      }
      throw error;
    }

    this.inFlight = false;
    this.clearBudgetTimer();
    this.cachedResult = result;
    for (const cb of this.readyListeners.splice(0)) {
      try {
        cb(result);
      } catch (err) {
        if (this.debug) console.error("[tracio] onReady listener threw", err);
      }
    }
    return result;
  }
}
