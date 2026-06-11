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

const tracio = Tracio.init({ publicKey: "tracio_pk_…" });

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
<script src="https://cdn.jsdelivr.net/npm/@tracio/sdk@0.1.1/dist/index.min.js"></script>
<!-- or: https://unpkg.com/@tracio/sdk@0.1.1/dist/index.min.js -->
<script>
  const tracio = TracioSDK.Tracio.init({ publicKey: "tracio_pk_…" });
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

| Field       | Type           | Default                    | Description                                                             |
| ----------- | -------------- | -------------------------- | ----------------------------------------------------------------------- |
| `publicKey` | `string`       | —                          | **Required.** Starts with `tracio_pk_`.                                 |
| `region`    | `"us" \| "eu"` | —                          | Region shorthand → edge endpoint. Ignored when `endpoint` is set.       |
| `endpoint`  | `string`       | `'https://edge.tracio.ai'` | Base URL of the edge server.                                            |
| `scriptUrl` | `string`       | —                          | Full override URL for `<script src>`. Escape hatch for SRI / self-host. |
| `linkedId`  | `string`       | —                          | Stable identifier you control (user/account id). Forwarded to the edge. |
| `tag`       | `string`       | —                          | Free-form label for the request (e.g. `checkout`, `login`).             |
| `debug`     | `boolean`      | `false`                    | Logs the script lifecycle and network to the console.                   |
| `timeoutMs` | `number`       | `8000`                     | Timeout for the full `getResult()`.                                     |

### `TracioInstance`

- `getVisitorId(): Promise<string>` — visitor UUID (resolves `getResult()` and returns its id).
- `getResult(): Promise<TracioResult>` — full result with bot info; cached after the first call.
- `onReady(cb: (result) => void): void` — fires once after the first successful result.
- `onError(cb: (err: TracioError) => void): void` — failure channel; notifies late subscribers of an already-happened error.
- `destroy(): void` — removes the `<script>`, releases the singleton, rejects pending promises.

### `TracioResult`

```ts
type TracioResult = {
  visitorId: string;
  requestId: string;
  bot: { detected: boolean; confidence: number /* 0–100 */; reasons?: string[] };
};
```

`bot.confidence` is a float in the range **0–100** (aligned with the edge RiskScore).

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
  const result = await Tracio.init({ publicKey: "tracio_pk_…" }).getResult();
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

## License

MIT
