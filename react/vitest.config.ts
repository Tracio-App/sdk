import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    // Hermetic: happy-dom fetches every injected <script src> for real. The
    // outcome then depends on the network, not the code — DNS fails instantly
    // in a sandbox, the live edge answers in tens of ms in CI — and tests that
    // race the load against a mocked global (repro-1449) flip with it. Every
    // injected tag now fires `load` without a request; load failures are
    // dispatched explicitly where a test needs them (loader.test.ts).
    environmentOptions: {
      happyDOM: {
        settings: { disableJavaScriptFileLoading: true, handleDisabledFileLoadingAsSuccess: true },
      },
    },
    globals: false,
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      // Floors measured 2026-10-07 (869f2cg1p), not targets: until then the
      // thresholds were never applied (`test` ran without --coverage), and the
      // written numbers were above what the suite reaches. Raise them as tests
      // are added; lowering one is a decision to record here.
      thresholds: { statements: 96, branches: 96, functions: 100, lines: 96 },
    },
  },
});
