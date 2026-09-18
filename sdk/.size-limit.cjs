// Budgets are brotli-compressed bytes.
//
// Raised 2026-09-16 (task 869f2cg1p) from 2.4 / 2.7 / 2.9 KB. The +~0.6 KB buys
// the custom-fields normalisation in src/fields.ts: byte-accurate length checks
// (TextEncoder, because Go counts bytes and UTF-16 length silently disagrees on
// Cyrillic), the key charset check, and the warnings themselves.
//
// Shrinking the messages was tried first and returned 45 bytes — the weight is
// in the checks, not in the prose. Gating them behind NODE_ENV was tried too
// and rejected: tsup does not substitute it (replaceNodeEnv is off, platform is
// "node"), so `process` would survive into dist/index.min.js and throw
// "process is not defined" for anyone loading the CDN bundle with a script tag —
// while size-limit, which bundles as browser, would have shown green.
module.exports = [
  {
    name: "@tracio/sdk (ESM)",
    path: "dist/index.js",
    limit: "3.1 KB",
  },
  {
    name: "@tracio/sdk (CJS)",
    path: "dist/index.cjs",
    limit: "3.4 KB",
  },
  {
    name: "@tracio/sdk (CDN/IIFE min)",
    path: "dist/index.min.js",
    limit: "3.45 KB",
  },
];
