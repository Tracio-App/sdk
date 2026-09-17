export type TracioErrorCode =
  // --- config / usage (terminal) ---
  | "invalid_config"
  | "multiple_keys"
  | "non_browser"
  // --- script loading (terminal unless retried) ---
  | "load_failed"
  | "blocked"
  | "script_error"
  // --- network / transport (often retryable) ---
  | "network"
  | "timeout"
  // --- edge / server (catch-all for upstream failures) ---
  | "server"
  // --- lifecycle ---
  | "destroyed";

/**
 * Terminal error codes — retrying the same call will not help.
 * Re-`init()` or fix the caller before trying again.
 */
const TERMINAL_CODES: ReadonlySet<TracioErrorCode> = new Set([
  "invalid_config",
  "multiple_keys",
  "non_browser",
  "destroyed",
]);

/**
 * Retryable error codes — a fresh attempt (new `init()` / `getResult()`)
 * may succeed (transient network, slow script, flaky upstream).
 */
const RETRYABLE_CODES: ReadonlySet<TracioErrorCode> = new Set([
  "load_failed",
  "blocked",
  "script_error",
  "network",
  "timeout",
  "server",
]);

export class TracioError extends Error {
  public readonly code: TracioErrorCode;

  constructor(code: TracioErrorCode, message: string) {
    super(message);
    this.name = "TracioError";
    this.code = code;
    Object.setPrototypeOf(this, TracioError.prototype);
  }

  /** `true` if a fresh attempt may succeed (transient). */
  get retryable(): boolean {
    return RETRYABLE_CODES.has(this.code);
  }

  /** `true` if retrying the same call cannot help (config/usage/lifecycle). */
  get terminal(): boolean {
    return TERMINAL_CODES.has(this.code);
  }

  override toString(): string {
    return `TracioError[${this.code}]: ${this.message}`;
  }
}

export function isTracioError(value: unknown): value is TracioError {
  return value instanceof TracioError;
}

/** Whether a thrown value is a retryable TracioError. */
export function isRetryableError(value: unknown): boolean {
  return isTracioError(value) && value.retryable;
}
