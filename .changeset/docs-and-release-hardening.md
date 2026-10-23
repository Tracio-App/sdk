---
"@tracio/sdk": patch
"@tracio/react": patch
"@tracio/vue": patch
"@tracio/angular": patch
"@tracio/svelte": patch
---

docs: READMEs describe the current contract

- `@tracio/sdk`: the CDN snippet pins the current version; `bot.confidence` is documented as
  the edge confidence ×100, not the dashboard RiskScore; `getResult()` caches a success and
  retries a `retryable` failure; the error table lists every `invalid_config` and `server`
  cause; the `fields` section says where the warnings come from.
- Wrappers: every `TracioConfig` field is documented (React lists them as props); React's
  `useVisitorId` no longer advertises a `getData()` it does not have, and `useTracio()` is
  documented with `unavailable`; Vue documents that the config is read once at `app.use`.
- Every package refuses `npm publish` without a built `dist/` (`prepublishOnly`).
