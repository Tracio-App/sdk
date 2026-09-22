# @tracio/sdk

Tracio vanilla JS loader — typed entry point for the per-key polymorphic edge runtime.

[![npm version](https://img.shields.io/npm/v/@tracio/sdk.svg)](https://www.npmjs.com/package/@tracio/sdk)
[![types](https://img.shields.io/npm/types/@tracio/sdk.svg)](https://www.npmjs.com/package/@tracio/sdk)

## Install

```bash
npm install @tracio/sdk
# pnpm add @tracio/sdk
# yarn add @tracio/sdk
```

Framework wrappers: [`@tracio/react`](https://www.npmjs.com/package/@tracio/react) · [`@tracio/vue`](https://www.npmjs.com/package/@tracio/vue) · [`@tracio/angular`](https://www.npmjs.com/package/@tracio/angular) · [`@tracio/svelte`](https://www.npmjs.com/package/@tracio/svelte).

## Quick start

```ts
import { Tracio } from "@tracio/sdk";

const tracio = Tracio.init({ publicKey: "5ca175fc…" });

const visitorId = await tracio.getVisitorId();
console.log("visitor:", visitorId);

const result = await tracio.getResult();
if (result.bot.detected) {
  console.warn("bot detected, confidence:", result.bot.confidence);
}
```

## CDN / `<script>`

A zero-build, minified IIFE bundle is published to unpkg and jsdelivr. The global is the
**module namespace** `TracioSDK`, so call `TracioSDK.Tracio.init(...)` (not `TracioSDK.init`).
Pin a version — never ship a floating `@latest` in production:

```html
<script src="https://cdn.jsdelivr.net/npm/@tracio/sdk@0.1.3/dist/index.min.js"></script>
<!-- or: https://unpkg.com/@tracio/sdk@0.1.3/dist/index.min.js -->
<script>
  const tracio = TracioSDK.Tracio.init({ publicKey: "5ca175fc…" });
  tracio.getResult().then((r) => {
    if (r.bot.detected) console.warn("bot:", r.bot.confidence);
  });
</script>
```

> `window.Tracio` is owned by the edge runtime the loader injects — it is **not** the SDK
> namespace. Always go through `TracioSDK`.

## API

### `Tracio.init(config: TracioConfig): TracioInstance`

Singleton factory. Calling it again with the same `publicKey` returns the existing instance.
Calling it with a _different_ key while another instance is still live throws
`TracioError("multiple_keys")` — `.destroy()` the previous instance first.

| Field          | Type                             | Default                    | Description                                                                                                                                                                    |
| -------------- | -------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `publicKey`    | `string`                         | —                          | **Required.** Copy from the dashboard → API Keys.                                                                                                                              |
| `region`       | `"us" \| "eu"`                   | —                          | Region shorthand → edge endpoint. Ignored when `endpoint` is set.                                                                                                              |
| `endpoint`     | `string`                         | `'https://edge.tracio.ai'` | Base URL of the edge server.                                                                                                                                                   |
| `scriptUrl`    | `string`                         | —                          | Full override URL for `<script src>`. Escape hatch for SRI / self-host.                                                                                                        |
| `linkedId`     | `string`                         | —                          | Your internal account id for the signed-in user. Links accounts that share a device (dashboard → Connections). Only for authenticated users; stable id, not an email.          |
| `linkedIdType` | `"email" \| "phone" \| "opaque"` | `"opaque"`                 | What `linkedId` holds. Only decides whether the id can join the cross-customer graph — **not** required for `linkedIdSig`. Requires `linkedId`.                                |
| `linkedIdSig`  | `string`                         | —                          | Server-computed `lowercase_hex(HMAC_SHA256(lid_secret, linkedId))` over the RAW id. **Send it whenever you send `linkedId`.** Requires `linkedId`.                             |
| `tag`          | `string`                         | —                          | Free-form label for the request (e.g. `checkout`, `login`).                                                                                                                    |
| `fields`       | `Record<string, string>`         | —                          | Custom fields attached to every event of this page load (e.g. `{ plan, order }`). Passed to the edge runtime in memory, never into the DOM. Values must be strings; see below. |
| `debug`        | `boolean`                        | `false`                    | Logs the script lifecycle and network to the console.                                                                                                                          |
| `timeoutMs`    | `number`                         | `15000`                    | Timeout for the full `getResult()` (raise if you see `timeout` errors).                                                                                                        |

### Account linking (`linkedId`)

Pass your internal account id when the user is signed in:

```ts
const tracio = Tracio.init({ publicKey: "tracio_pk_…", linkedId: user.id });
```

Tracio then links accounts that appear on the same device — the dashboard's
**Connections** page is built entirely from this signal, so without `linkedId`
it stays empty. Do **not** send emails, `guest`, or empty strings (they would
merge unrelated people). In SPAs, call `tracio.destroy()` and then
`Tracio.init({ publicKey, linkedId })` after login — you must destroy first
because `Tracio.init` with the same `publicKey` reuses the existing live
instance and ignores new config.
For details see [tracio.ai/docs/account-linking](https://tracio.ai/docs/account-linking).

### Custom fields (`fields`)

Attach your own key → value pairs to every event of the page load — an order
reference, a plan, an A/B bucket:

```ts
const tracio = Tracio.init({
  publicKey: "tracio_pk_…",
  fields: { plan: "pro", order: "A-1029" },
});
```

The map is handed to the edge runtime as an argument of its `get()` call and
lives in the runtime's memory only. It is **not** written to the page: not as
an attribute on the injected `<script>`, not in the script URL, not on
`window`. Other scripts on the same page — analytics tags, A/B tools, session
replay — cannot read it. (A hand-written `<script>` tag uses the
`data-tracio-fields` attribute instead; that attribute sits in the markup for
the life of the page, which is why the SDK does not use it.)

Values must be **strings** — that is what the type says, and what you should
send. A non-string that slips through at runtime (`null` from a logged-out
user, a number) does **not** throw and does not cost you the visit: the SDK
warns on the console and sends the value anyway, and the edge stores what it
can as text. Limits are enforced server-side and apply per field, not per
visit: 50 fields, key ≤ 40 bytes matching `[A-Za-z0-9_.:-]`, value ≤ 500
bytes, no ASCII control characters. A field over the limit is dropped and
counted in the dashboard's rejected-fields counter; the visit itself is always
recorded. The page gets no synchronous feedback — check the dashboard or the
Data API (`fields` on a session). Values must be known when the page renders;
for values that arrive later (order total, payment outcome) use
`POST /v1/events/fields` in the Data API. Values are stored in clear only
inside your own workspace and never enter the cross-customer graph. In SPAs
the same rule as for `linkedId` applies: `destroy()` and re-`init` to change
fields — a live instance ignores new config.

**Personal data does not belong here.** An email or a phone number is an
attribute of the account, not of one page view, and it should never pass
through the visitor's browser at all: send it from your backend with
`POST /v1/accounts/metadata` (Data API, "Account metadata"), keyed by the
same `linkedId` you already pass to `init`. The dashboard shows it wherever
the account appears. `fields` is for data that describes the visit.

### Signing the account id (`linkedIdSig`)

**Sign every `linkedId` you send.** `linkedId` travels in the script URL, so an
unsigned one can be forged by the visitor: typing someone else's id into the
address bar attaches their browsing to that account. That poisons the account
owner's behavioural baseline and makes ATO verdicts on the account meaningless
— so ATO Watch needs the id to be _signed_, not merely present. (Earlier
versions of this README said an unsigned id was enough for ATO. It is not.)

Compute the signature **on your server** (the secret must never reach the
browser; grab it in the dashboard → Settings → Identity) over the **raw** id —
sign first, URL-encoding happens inside the SDK:

```js
// Node.js — your server
import crypto from "node:crypto";
const sig = crypto
  .createHmac("sha256", process.env.TRACIO_LID_SECRET)
  .update(user.id, "utf8") // the RAW value you pass as linkedId
  .digest("hex"); // lowercase hex

// Browser — pass it down with the page
const tracio = Tracio.init({
  publicKey: "tracio_pk_…",
  linkedId: user.id,
  linkedIdSig: sig,
});
```

`linkedIdType` is **optional and independent of the signature**. Set it to
`"email"` or `"phone"` only when `linkedId` really is one and you want the id to
join the cross-customer identity graph — that graph needs a canonical email or
phone, which is the sole reason the type exists. An opaque internal id is signed
and verified exactly the same way; it simply stays inside your workspace.

`linkedIdType` or `linkedIdSig` without `linkedId` throws
`TracioError("invalid_config")`, as does an unknown `linkedIdType`. An invalid
signature does not fail the request — the id stays unsigned, and the dashboard
(Settings → Environments, **Signing** column) shows it.

Note: `scriptUrl` overrides the **whole** script URL, so with it set the SDK
cannot append `lid` / `lid_type` / `lid_sig` — self-host integrations must
include those query parameters in the URL they build themselves.

### `TracioInstance`

- `getVisitorId(): Promise<string>` — visitor UUID (resolves `getResult()` and returns its id).
- `getResult(): Promise<TracioResult>` — full result with bot info; cached after the first call.
- `onReady(cb: (result) => void): void` — fires once after the first successful result.
- `onError(cb: (err: TracioError) => void): void` — failure channel; notifies late subscribers of an already-happened error.
- `destroy(): void` — removes the `<script>` and the `window.Tracio` its bundle installed, releases the singleton, rejects pending promises. A following `init` waits for the runtime of the tag it injects, so its `fields` reach that visit and not the finished one.

### `TracioResult`

```ts
type TracioResult = {
  visitorId: string;
  bot: { detected: boolean; confidence: number /* 0–100 */; reasons?: string[] };
};
```

`visitorId` is the canonical visitor identity. `bot.detected` is `true` when the edge
verdict is `bot`; `bot.confidence` is a float in the range **0–100** (aligned with the edge
RiskScore); `bot.reasons` lists the signal markers that drove the verdict.

### `TracioError`

Thrown / rejected with one of the following codes. Each error exposes `retryable` and
`terminal` getters; use the `isTracioError` / `isRetryableError` helpers to narrow.

| Code             | `retryable` | When                                                                             |
| ---------------- | :---------: | -------------------------------------------------------------------------------- |
| `invalid_config` |     no      | `publicKey` is missing / not a string                                            |
| `multiple_keys`  |     no      | `Tracio.init` called with a different key while an instance is live              |
| `non_browser`    |     no      | `getResult()` awaited on the server (Node) — browser-only                        |
| `load_failed`    |     yes     | `<script>` `onerror` (network / CSP / CORS)                                      |
| `blocked`        |     yes     | Script loaded but `window.Tracio` never appeared before timeout (likely adblock) |
| `script_error`   |     yes     | Runtime error inside the injected edge script _(reserved)_                       |
| `network`        |     yes     | Transport-level fetch failure _(reserved)_                                       |
| `timeout`        |     yes     | `getResult()` exceeded `timeoutMs`                                               |
| `server`         |     yes     | `window.Tracio.load().get()` threw (upstream / parse failure)                    |
| `destroyed`      |     no      | A pending promise was rejected by `destroy()`                                    |

`terminal` is the inverse of `retryable` for the config/usage/lifecycle codes — retrying the
same call cannot help; fix the caller or re-`init()`.

> `script_error` and `network` are part of the taxonomy but not yet emitted by the current
> loader (script failures surface as `load_failed`, `.get()` failures as `server`). They are
> reserved for finer-grained classification and are safe to switch on today.

### Error handling & adblock

```ts
import { Tracio, isTracioError, isRetryableError } from "@tracio/sdk";

try {
  const result = await Tracio.init({ publicKey: "5ca175fc…" }).getResult();
  // …use result
} catch (err) {
  if (isRetryableError(err)) {
    // transient (blocked / load_failed / timeout / network / server) — a fresh attempt may work
    if (isTracioError(err) && err.code === "blocked") {
      // adblock / CSP blocked the edge script — fall back gracefully
    }
  } else if (isTracioError(err)) {
    // terminal (invalid_config / multiple_keys / non_browser) — fix the caller
  }
}
```

**Adblock / CSP mitigation.** When the edge script is blocked you get `TracioError("blocked")`.
To avoid this, serve the edge from a first-party domain via `endpoint` (a CNAME you control,
e.g. `https://t.example.com`) or point `scriptUrl` at a same-origin proxy. Make sure your CSP
allows the loader and edge in `script-src` and `connect-src`.

## SSR

`Tracio.init` on the server (Node) returns a stub instance. `getResult()` on the server
**rejects fast** with a typed `TracioError("non_browser")` — it does _not_ hang — so guard it
out of server-render paths. All framework wrappers (`@tracio/react`, `@tracio/vue`, etc.)
apply the SSR guard automatically.

## Bundle size

Brotli-compressed, enforced as CI budgets:

| Artifact                  | Budget |
| ------------------------- | ------ |
| ESM (`index.js`)          | 2.4 KB |
| CJS (`index.cjs`)         | 2.7 KB |
| CDN/IIFE (`index.min.js`) | 2.9 KB |

## Privacy & consent

Tracio performs device fingerprinting and bot detection. Depending on your jurisdiction
(GDPR/ePrivacy, CCPA, …) this may require a lawful basis and/or user consent. Gate
`Tracio.init(...)` behind your consent-management platform (CMP) and only call it once the
relevant consent is granted. Disclose the processing in your privacy policy. See
[tracio.ai](https://tracio.ai) for the data-processing terms.

## Example

Runnable vanilla CDN demo: [`../examples/sdk`](../examples/sdk).

## License

MIT
