import { defineConfig } from "tsup";
import { withPreset } from "@tracio/internal-config/tsup.preset";

export default defineConfig([
  // Main library build: dual ESM + CJS + .d.ts/.d.cts (shared preset).
  withPreset(),
  // M1 — zero-build CDN bundle: a single self-contained, minified IIFE for a
  // plain <script src="https://unpkg.com/@tracio/sdk"> trial path (mirrors
  // FingerprintJS's fp.min.js). globalName is "TracioSDK", NOT "Tracio":
  // window.Tracio is owned at runtime by the per-key edge script (s.js) that
  // the loader injects and waits for — claiming it here would collide. So the
  // package namespace lands on window.TracioSDK; usage is
  // `TracioSDK.Tracio.init({ publicKey })`.
  {
    entry: { "index.min": "src/index.ts" },
    format: ["iife"],
    globalName: "TracioSDK",
    minify: true,
    sourcemap: true,
    dts: false,
    clean: false, // don't wipe the main build above
    splitting: false,
    outDir: "dist",
    target: "es2018", // wider browser reach for a CDN script tag
    outExtension: () => ({ js: ".js" }),
  },
]);
