// Budgets are brotli-compressed bytes.
//
// Raised 2026-09-17 (task 869f2cg1p) from 950 B. The wrapper grew twice in the
// same release and neither part is decoration:
//
//   * useStableFields / sameFields / sameValue — the `fields` prop is compared
//     by value instead of being round-tripped through JSON.stringify. The old
//     comparison threw on the very inputs the core is meant to warn about
//     (BigInt, cycles), so a misconfigured field killed the provider instead of
//     producing a console warning.
//   * `unavailable: TracioError` in the context value, plus deriving that
//     reason. Without it a missing publicKey left every hook in `isLoading`
//     forever, with nothing in the API saying why the instance never arrives.
//
// Both are contract, not prose: shrinking strings cannot buy them back, and
// hiding them behind NODE_ENV is rejected for this repo for the reason recorded
// in sdk/.size-limit.cjs (tsup does not substitute it).
module.exports = [{ name: "@tracio/react (ESM)", path: "dist/index.js", limit: "1.3 KB" }];
