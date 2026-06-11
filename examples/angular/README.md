# @tracio/angular example

Minimal Vite + Angular 20 (standalone, JIT via
[`@analogjs/vite-plugin-angular`](https://www.npmjs.com/package/@analogjs/vite-plugin-angular)) app
consuming the published [`@tracio/angular`](https://www.npmjs.com/package/@tracio/angular) wrapper.
Registers `provideTracio(...)` and renders the visitor id + bot result via `TracioService` signals.

## Run

```bash
npm install
npm run dev
```

Open the printed URL (default <http://localhost:5173>).

## Configure

Edit the constants at the top of [`src/main.ts`](./src/main.ts):

```ts
const PUBLIC_KEY = "tracio_pk_..."; // your public key from Settings → API keys
const ENDPOINT = "https://edge.tracio.dev"; // dev edge; use https://edge.tracio.ai for prod
```

## How it works

`provideTracio({ publicKey, endpoint })` is spread into the bootstrap providers. `TracioService`
exposes three readonly signals — `visitorId()`, `result()`, and `error()`. The component reads
`result()` and `error()` to render the loading, error, and resolved states, where `result` is the
full `TracioResult` (`{ visitorId, requestId, bot }`).
