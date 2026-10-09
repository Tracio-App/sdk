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
// Raised again 2026-09-21 (task 869f3zamy) from 3.1 / 3.4 / 3.45 KB. The
// +0.27 KB buys the verdict the edge now returns with the identification
// response: the four new `TracioResult` fields and the check that turns the
// wire object into a typed one — the advice vocabulary, the six required
// fields, the basis filter.
//
// Measured, not estimated (brotli, ESM / CJS / CDN):
//   3.08 / 3.36 / 3.42 — before this change;
//   3.19 / 3.46 / 3.52 — the four fields with NO check, the wire object cast
//     to the public type. Already over the old budget, so the budget had to
//     move either way, and the cast would have made `inlineGuidance.payment`
//     promise an advice the response never had to carry;
//   3.30 / 3.59 / 3.64 — the same check written as a loop over the scenario
//     keys. Returned ~45 bytes and cost a double cast through `unknown`;
//   3.35 / 3.63 / 3.69 — what is here: explicit checks, no casts.
//
// The 45 bytes were not worth the cast, for the same reason the warnings above
// were not worth the NODE_ENV guard: this file pays for what the package does
// at runtime, and the way to spend less is to do less, not to hide it.
module.exports = [
  {
    name: "@tracio/sdk (ESM)",
    path: "dist/index.js",
    limit: "3.4 KB",
  },
  {
    name: "@tracio/sdk (CJS)",
    path: "dist/index.cjs",
    limit: "3.65 KB",
  },
  {
    name: "@tracio/sdk (CDN/IIFE min)",
    path: "dist/index.min.js",
    limit: "3.72 KB",
  },
];
