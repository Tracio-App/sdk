# @tracio/react example

Minimal Vite + React 19 app consuming the published
[`@tracio/react`](https://www.npmjs.com/package/@tracio/react) wrapper. Wraps the app in
`<TracioProvider>` and renders the visitor id + bot result via the `useTracioResult()` hook.

## Run

```bash
npm install
npm run dev
```

Open the printed URL (default <http://localhost:5173>).

## Configure

Edit the constants at the top of [`src/main.tsx`](./src/main.tsx):

```ts
const PUBLIC_KEY = "tracio_pk_..."; // your public key from Settings → API keys
const ENDPOINT = "https://edge.tracio.dev"; // dev edge; use https://edge.tracio.ai for prod
```

## How it works

`<TracioProvider config={{ publicKey, endpoint }}>` mounts the Tracio script client-side. Inside it,
`useTracioResult()` returns `{ data, isLoading, error }` where `data` is the full `TracioResult`
(`{ visitorId, requestId, bot }`). The example renders a loading state, an error state, and the
resolved visitor id + human/bot verdict.
