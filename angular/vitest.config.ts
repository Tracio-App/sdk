import { defineConfig } from "vitest/config";

export default defineConfig({
  // Angular JIT (used in TestBed-based unit tests) relies on legacy
  // experimentalDecorators. The library build itself is produced by
  // ng-packagr in Ivy partial-compilation mode (see ng-package.json /
  // tsconfig.json), so this esbuild setting only affects the test transform,
  // not the published artifact.
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Floors measured 2026-10-07 (869f2cg1p), not targets: until then the
      // thresholds were never applied (`test` ran without --coverage), and the
      // written numbers were above what the suite reaches. Raise them as tests
      // are added; lowering one is a decision to record here.
      thresholds: { statements: 100, branches: 71, functions: 100, lines: 100 },
    },
  },
});
