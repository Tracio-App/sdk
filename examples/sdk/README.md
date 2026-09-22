# @tracio/sdk — vanilla CDN example

The smallest possible Tracio integration: a single static HTML page that loads
[`@tracio/sdk`](https://www.npmjs.com/package/@tracio/sdk) from the unpkg CDN, fingerprints the
visitor, and renders the visitor id + bot result on screen. No build step, no `npm install`.

## Run

The SDK fetches a per-key script over the network, so it must be served over `http(s)://` — opening
the file with a `file://` URL will not work. Any static server is fine:

```bash
npx serve .
# or: python3 -m http.server 8080
```

Then open the printed URL (e.g. <http://localhost:3000>).

## Configure

Edit the two constants near the bottom of [`index.html`](./index.html):

```js
const PUBLIC_KEY = "tracio_pk_..."; // your public key from Settings → API keys
const ENDPOINT = "https://edge.tracio.dev"; // dev edge; use https://edge.tracio.ai for prod
```

## What it shows

`Tracio.init(...).getResult()` resolves to a `TracioResult`:

```ts
{ visitorId: string; requestId: string; bot: { detected: boolean; confidence: number; reasons?: string[] } }
```

The page renders the visitor id and a human/bot verdict, plus the full raw JSON.
