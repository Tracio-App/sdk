import { describe, expect, it } from "vitest";

import {
  TracioError,
  isRetryableError,
  isTracioError,
  type TracioErrorCode,
} from "../src/errors.js";

describe("TracioError", () => {
  it("создаёт Error с кодом из таксономии", () => {
    const err = new TracioError("invalid_config", "publicKey is required");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("TracioError");
    expect(err.code).toBe("invalid_config");
    expect(err.message).toBe("publicKey is required");
  });

  it("содержит все коды расширенной таксономии", () => {
    const codes: TracioErrorCode[] = [
      "invalid_config",
      "multiple_keys",
      "non_browser",
      "load_failed",
      "blocked",
      "script_error",
      "network",
      "timeout",
      "server",
      "destroyed",
    ];
    for (const code of codes) {
      const err = new TracioError(code, "x");
      expect(err.code).toBe(code);
    }
  });

  it("non_browser код существует и terminal", () => {
    const err = new TracioError("non_browser", "browser-only");
    expect(err.code).toBe("non_browser");
    expect(err.terminal).toBe(true);
    expect(err.retryable).toBe(false);
  });

  it("retryable/terminal группировка корректна", () => {
    const retryable: TracioErrorCode[] = [
      "load_failed",
      "blocked",
      "script_error",
      "network",
      "timeout",
      "server",
    ];
    const terminal: TracioErrorCode[] = [
      "invalid_config",
      "multiple_keys",
      "non_browser",
      "destroyed",
    ];
    for (const code of retryable) {
      const err = new TracioError(code, "x");
      expect(err.retryable).toBe(true);
      expect(err.terminal).toBe(false);
    }
    for (const code of terminal) {
      const err = new TracioError(code, "x");
      expect(err.terminal).toBe(true);
      expect(err.retryable).toBe(false);
    }
  });

  it("retryable и terminal взаимоисключающи для каждого кода", () => {
    const all: TracioErrorCode[] = [
      "invalid_config",
      "multiple_keys",
      "non_browser",
      "load_failed",
      "blocked",
      "script_error",
      "network",
      "timeout",
      "server",
      "destroyed",
    ];
    for (const code of all) {
      const err = new TracioError(code, "x");
      expect(err.retryable).not.toBe(err.terminal);
    }
  });

  it("isRetryableError() гард: true только для retryable TracioError", () => {
    expect(isRetryableError(new TracioError("network", "x"))).toBe(true);
    expect(isRetryableError(new TracioError("timeout", "x"))).toBe(true);
    expect(isRetryableError(new TracioError("invalid_config", "x"))).toBe(false);
    expect(isRetryableError(new TracioError("non_browser", "x"))).toBe(false);
    expect(isRetryableError(new Error("plain"))).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError({ code: "network" })).toBe(false);
  });

  it("isTracioError() type guard", () => {
    const err = new TracioError("blocked", "x");
    const notErr = new Error("plain");
    const other = { code: "blocked", message: "x" };

    expect(isTracioError(err)).toBe(true);
    expect(isTracioError(notErr)).toBe(false);
    expect(isTracioError(other)).toBe(false);
    expect(isTracioError(null)).toBe(false);
    expect(isTracioError(undefined)).toBe(false);
  });

  it("toString включает код и сообщение", () => {
    const err = new TracioError("timeout", "took too long");
    expect(err.toString()).toContain("TracioError");
    expect(err.toString()).toContain("[timeout]");
    expect(err.toString()).toContain("took too long");
  });
});
