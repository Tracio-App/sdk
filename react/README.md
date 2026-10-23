# @tracio/react

React Provider + hooks for the Tracio bot detection SDK.

## Install

```bash
npm install @tracio/react @tracio/sdk
```

(React 18 or 19 must be installed separately.)

## Quick start

```tsx
import { TracioProvider, useVisitorId } from "@tracio/react";

function App() {
  return (
    <TracioProvider publicKey={process.env.NEXT_PUBLIC_TRACIO_KEY!}>
      <Page />
    </TracioProvider>
  );
}

function Page() {
  const { data: visitorId, isLoading, error } = useVisitorId();
  if (isLoading) return <span>Loading…</span>;
  if (error) return <span>Error: {error.message}</span>;
  return <span>Visitor: {visitorId}</span>;
}
```

## API

### `<TracioProvider publicKey="…">`

Wraps your app. Mounts the Tracio script on first render via `useEffect`. On unmount, calls `tracio.destroy()`.

Every field of the core [`TracioConfig`](https://www.npmjs.com/package/@tracio/sdk#tracioinitconfig-tracioconfig-tracioinstance) is accepted, either as a flat prop or inside
`config` (a field in `config` wins over the flat prop of the same name):

| Prop           | Type                             | Description                                                            |
| -------------- | -------------------------------- | ---------------------------------------------------------------------- |
| `publicKey`    | `string`                         | **Required** (here or as `config.publicKey`). Copy from the dashboard. |
| `config`       | `TracioConfig`                   | Full config object                                                     |
| `endpoint`     | `string`                         | Base URL of the edge server                                            |
| `region`       | `"us" \| "eu"`                   | Region shorthand; ignored when `endpoint` is set                       |
| `scriptUrl`    | `string`                         | Full override URL for the edge `<script>`                              |
| `linkedId`     | `string`                         | Your account id for the signed-in user (account linking)               |
| `linkedIdType` | `"email" \| "phone" \| "opaque"` | What `linkedId` holds                                                  |
| `linkedIdSig`  | `string`                         | Server-computed HMAC of `linkedId`                                     |
| `tag`          | `string`                         | Free-form label for the request                                        |
| `fields`       | `Record<string, string>`         | Custom fields; compared by value, so an inline object literal is fine  |
| `debug`        | `boolean`                        | Logs the script lifecycle to the console                               |
| `timeoutMs`    | `number`                         | Timeout for the full result                                            |

Semantics and limits of each field are in the core README. Changing any of them
re-creates the instance — `destroy()` and `init` with the new config — which
loads the edge script again and records a new visit.

A missing `publicKey` (typically an unset environment variable) does not leave a
silent spinner: the provider logs it, and every hook settles with
`error.code === "invalid_config"`.

### `useTracio(): { tracio: TracioInstance | null; unavailable: TracioError | null }`

Escape hatch — raw `TracioInstance`. `tracio` is `null` on SSR, outside `<TracioProvider>`,
and before the first effect runs; `unavailable` is set when the provider will never produce
an instance (no `publicKey`), so `null` with no `unavailable` means "not yet".

### `useVisitorId(opts?): { data, isLoading, error, isFetched, getId }`

- `data: string | undefined` — visitor UUID once resolved
- `isLoading: boolean` — true while the initial fetch is in flight
- `error: TracioError | null` — set if fetch failed
- `isFetched: boolean` — true once the fetch has settled (success or error)
- `getId(): Promise<string>` — imperatively (re)fetch and resolve the visitor id

Pass `{ immediate: false }` to skip the on-mount fetch and trigger it yourself via `getId()`.
For the full result use `useTracioResult()`.

### `useTracioResult(opts?): { data, isLoading, error, isFetched, getData }`

Same state shape; `data` is the full `TracioResult`. `getData(): Promise<TracioResult>` imperatively (re)fetches; `{ immediate: false }` defers the on-mount fetch.

## SSR

- Server: hooks return `isLoading: true, data: undefined`. The script doesn't mount; `tracio` is `null`.
- Client: `useEffect` runs, instance is created, result fetched.
- Next.js: the `'use client'` directive is automatically applied (tsup onSuccess hook).

## Example

Runnable Vite + React app: [`../examples/react`](../examples/react).

## License

MIT
