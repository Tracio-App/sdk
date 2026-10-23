---
"@tracio/sdk": minor
---

feat: `TracioResult.inlineTokenV2` — the inline verdict in the `tracio_vt2` format

The identification response now carries the same signed verdict twice: `inlineToken`
(`tracio_vt1`, camelCase claims) and `inlineTokenV2` (`tracio_vt2`, snake_case claims:
`request_id`, `computed_at`, …). Both are signed with the same key and verified the same
way; only the prefix and the claim names differ. Move your backend to `inlineTokenV2` —
`inlineToken` stays available until 2027-04-12. The claim set of each format is closed:
a strict verifier rejects an unknown claim, and a new claim will only ever arrive under a
new prefix.
