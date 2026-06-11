import { isPlatformBrowser } from "@angular/common";
import {
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  type Provider,
  inject,
  signal,
} from "@angular/core";
import {
  Tracio,
  type TracioConfig,
  type TracioError,
  type TracioInstance,
  type TracioResult,
} from "@tracio/sdk";

const TRACIO_CONFIG = new InjectionToken<TracioConfig>("TRACIO_CONFIG");

export function provideTracio(config: TracioConfig): Provider[] {
  return [{ provide: TRACIO_CONFIG, useValue: config }, TracioService];
}

export interface GetVisitorDataOptions {
  /**
   * Forward-compatible cache-bypass hint (FP parity). The SDK caches the result
   * for the instance's lifetime, so today both paths resolve from that cache.
   */
  ignoreCache?: boolean;
}

@Injectable({ providedIn: "root" })
export class TracioService {
  private readonly _visitorId = signal<string | null>(null);
  private readonly _result = signal<TracioResult | null>(null);
  private readonly _error = signal<TracioError | null>(null);
  private readonly _isLoading = signal(false);

  readonly visitorId = this._visitorId.asReadonly();
  readonly result = this._result.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  private readonly instance: TracioInstance | null = null;

  constructor() {
    const config = inject(TRACIO_CONFIG);
    const platformId = inject(PLATFORM_ID);
    if (!isPlatformBrowser(platformId)) return;

    this.instance = Tracio.init(config);
    void this.getVisitorData();
  }

  /**
   * Imperatively (re-)fetch the visitor result. Additive parity with the
   * FP Angular service `getVisitorData()` and the React/Vue `getData()` seam —
   * previously the service only fetched once in the constructor.
   *
   * @param opts forward-compatible per-call options ({@link GetVisitorDataOptions}).
   * @param ignoreCache forward-compatible cache-bypass hint (FP positional
   *   parity); merged with `opts.ignoreCache`. The SDK caches the result for the
   *   instance's lifetime, so repeated calls resolve from that cache today.
   */
  async getVisitorData(
    opts?: GetVisitorDataOptions,
    ignoreCache?: boolean,
  ): Promise<TracioResult | null> {
    if (!this.instance) return null;
    // Reserved seam: resolve the cache-bypass hint from either form. The SDK
    // does not yet support per-call cache bypass, so this is recorded but a
    // no-op until the edge contract exposes it.
    void (ignoreCache ?? opts?.ignoreCache ?? false);
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const result = await this.instance.getResult();
      this._result.set(result);
      this._visitorId.set(result.visitorId);
      return result;
    } catch (error) {
      this._error.set(error as TracioError);
      return null;
    } finally {
      this._isLoading.set(false);
    }
  }
}

export { TracioError, isTracioError, isRetryableError } from "@tracio/sdk";
export type { TracioConfig, TracioErrorCode, TracioResult, TracioInstance } from "@tracio/sdk";
