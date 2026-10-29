import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Floors measured 2026-10-07 (869f2cg1p), not targets: until then the
      // thresholds were never applied (`test` ran without --coverage), and the
      // written numbers were above what the suite reaches. Raise them as tests
      // are added; lowering one is a decision to record here.
      thresholds: { statements: 89, branches: 88, functions: 84, lines: 89 },
    },
  },
});
