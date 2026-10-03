---
"@tracio/sdk": minor
"@tracio/react": minor
"@tracio/vue": minor
"@tracio/angular": minor
"@tracio/svelte": minor
---

feat: the verdict arrives with the identification response — `TracioResult.inlineGuidance`, `inlineToken`, `inlinePartial`, `requestId`

Your rules and lists are applied before the response is written, so `getResult()` now
carries the advice for the four places a decision is usually made (`payment`,
`registration`, `login`, `affiliate`) plus the strictest of them as `overall` — with no
second request and no API quota spent. `basis` names the axes that raised it.

All four fields are optional, and each absence is a fact about your setup rather than a
failure: a workspace with no rules and no lists gets no verdict at all, and an edge node
running without its signing key answers with the verdict and without `inlineToken`.
`inlinePartial` is `true` whenever axes were left out — today always, because account
takeover, person, reputation and behaviour land after this response, so the webhook can
advise more strictly on the same visit.

Decide on `inlineToken`, not on the object: the object lives in the browser and a bot can
rewrite it before your form is posted. The token is the same verdict signed by the edge
(Ed25519, the webhook format and verification path, its own `kid` at
`/.well-known/webhook-keys`); verify it on your backend and check the `requestId` inside
it against the request you are handling. See the SDK README, "Verdict in the response".
