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

| Prop        | Type           | Description                           |
| ----------- | -------------- | ------------------------------------- |
| `publicKey` | `string`       | Shortcut for `config={{ publicKey }}` |
| `config`    | `TracioConfig` | Full config object                    |

### `useTracio(): { tracio: TracioInstance | null }`

Escape hatch — raw `TracioInstance`. `null` on SSR or outside `<TracioProvider>`.

### `useVisitorId(opts?): { data, isLoading, error, isFetched, getId, getData }`

- `data: string | undefined` — visitor UUID once resolved
- `isLoading: boolean` — true while the initial fetch is in flight
- `error: TracioError | null` — set if fetch failed
- `isFetched: boolean` — true once the fetch has settled (success or error)
- `getId(): Promise<string>` — imperatively (re)fetch and resolve the visitor id
- `getData(): Promise<TracioResult>` — imperatively (re)fetch the full result

Pass `{ immediate: false }` to skip the on-mount fetch and trigger it yourself via `getId()` / `getData()`.

### `useTracioResult(opts?): { data, isLoading, error, isFetched, getData }`

Same shape; `data` is the full `TracioResult` (`{ visitorId, bot }`). `getData()` imperatively (re)fetches; `{ immediate: false }` defers the on-mount fetch.

## SSR

- Server: hooks return `isLoading: true, data: undefined`. The script doesn't mount; `tracio` is `null`.
- Client: `useEffect` runs, instance is created, result fetched.
- Next.js: the `'use client'` directive is automatically applied (tsup onSuccess hook).

## Example

Runnable Vite + React app: [`../examples/react`](../examples/react).

## License

MIT
