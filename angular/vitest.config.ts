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
      thresholds: { statements: 85, branches: 80, functions: 100, lines: 85 },
    },
  },
});
