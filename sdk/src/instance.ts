import { TracioError } from "./errors.js";
import { loadAndFetch } from "./loader.js";
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
  private readonly tag: string | undefined;
  private readonly timeoutMs: number;
  private readonly debug: boolean;
  private resultPromise: Promise<TracioResult> | undefined;
  private cachedResult: TracioResult | undefined;
  private cachedError: TracioError | undefined;
  private readyListeners: ReadyListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private rejectDestroy: ((err: TracioError) => void) | undefined;

  constructor(config: TracioConfig) {
    if (!config.publicKey || typeof config.publicKey !== "string") {
      throw new TracioError("invalid_config", "publicKey is required and must be a string");
    }
    this.publicKey = config.publicKey;
    this.endpoint = resolveEndpoint(config);
    this.scriptUrl = config.scriptUrl;
    this.linkedId = config.linkedId;
    this.tag = config.tag;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
      const script = document.querySelector(`script[data-tracio-key="${this.publicKey}"]`);
      script?.remove();
    }

    if (this.rejectDestroy) {
      this.rejectDestroy(new TracioError("destroyed", "instance destroyed mid-fetch"));
    }

    this.readyListeners = [];
    this.errorListeners = [];
    this.cachedResult = undefined;
    this.cachedError = undefined;
    this.resultPromise = undefined;
  }

  private async fetchOnce(): Promise<TracioResult> {
    const destroyPromise = new Promise<never>((_, reject) => {
      this.rejectDestroy = reject;
    });
    destroyPromise.catch(() => undefined); // suppress unhandled rejection if fetch wins

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
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
      tag: this.tag,
    });

    let result: TracioResult;
    try {
      result = await Promise.race([fetchPromise, destroyPromise, timeoutPromise]);
    } catch (err) {
      const error =
        err instanceof TracioError ? err : new TracioError("server", `unexpected: ${String(err)}`);
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
