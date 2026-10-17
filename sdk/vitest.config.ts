import { defineConfig } from "vitest/config";

export default defineConfig({
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
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/types.ts"],
      // Floors measured 2026-10-07 (869f2cg1p), not targets: until then the
      // thresholds were never applied (`test` ran without --coverage), and the
      // written numbers were above what the suite reaches. Raise them as tests
      // are added; lowering one is a decision to record here.
      thresholds: { statements: 98, branches: 94, functions: 100, lines: 98 },
    },
  },
});
