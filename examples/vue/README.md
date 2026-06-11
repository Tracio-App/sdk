# @tracio/vue example

Minimal Vite + Vue 3 app consuming the published
[`@tracio/vue`](https://www.npmjs.com/package/@tracio/vue) wrapper. Installs the `TracioPlugin` and
renders the visitor id + bot result via the `useTracioResult()` composable.

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

`app.use(TracioPlugin, { publicKey, endpoint })` provides a Tracio instance app-wide.
`useTracioResult()` returns reactive refs `{ data, isLoading, error }` where `data` is the full
`TracioResult` (`{ visitorId, requestId, bot }`). [`src/App.vue`](./src/App.vue) renders the loading,
error, and resolved states.
