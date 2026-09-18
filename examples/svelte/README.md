# @tracio/svelte example

Minimal Vite + Svelte 5 app consuming the published
[`@tracio/svelte`](https://www.npmjs.com/package/@tracio/svelte) wrapper. Bootstraps the SDK with
`Tracio.init(...)` and renders the visitor id + bot result via the `useTracioResult()` store.

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

`Tracio.init(...)` is called once on app boot ([`src/main.ts`](./src/main.ts)). `useTracioResult()`
returns a Svelte store; [`src/App.svelte`](./src/App.svelte) reads it with the `$result`
auto-subscription syntax to render `{ data, isLoading, error }`, where `data` is the full
`TracioResult` (`{ visitorId, requestId, bot }`).

> In SvelteKit, wrap `Tracio.init` in `if (browser)` from `$app/environment` so it only runs
> client-side.
