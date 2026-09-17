# @tracio/svelte

Svelte 5 wrapper for the Tracio bot detection SDK.

## Install

```bash
npm install @tracio/svelte @tracio/sdk
```

(Svelte 5 must be installed separately.)

## Quick start

```svelte
<!-- +layout.svelte -->
<script>
  import { Tracio } from "@tracio/svelte";
  import { browser } from "$app/environment";

  if (browser) {
    Tracio.init({ publicKey: import.meta.env.VITE_TRACIO_KEY });
  }
</script>

<slot />
```

```svelte
<!-- AnyComponent.svelte -->
<script>
  import { useVisitorId } from "@tracio/svelte";

  const visitor = useVisitorId();
</script>

{#if $visitor.isLoading}
  Loading…
{:else if $visitor.error}
  Error: {$visitor.error.message}
{:else}
  Visitor: {$visitor.data}
{/if}
```

(`$visitor` is Svelte's auto-subscription syntax for stores.)

## API

### `Tracio.init(config: TracioConfig): TracioInstance`

Per-tree context wrapper around the core `Tracio.init()` — each call owns its own result store (no module singleton). Call once on app boot (client-side only — wrap in `if (browser)` for SvelteKit SSR safety).

### `useVisitorId(): Readable<{ data, isLoading, error }>`

Svelte store. Access via `$store` syntax in `.svelte` components.

- `data: string | undefined`
- `isLoading: boolean`
- `error: TracioError | null`

### `useTracioResult(opts?): Readable<{ data, isLoading, error }> & { getData }`

Same store shape; `data` is the full `TracioResult`. The returned store also exposes `getData(): Promise<void>` to imperatively (re)fetch; pass `{ immediate: false }` to skip the on-mount fetch.

## Roadmap

**v0.2.0** — Svelte 5 runes-class API (`useVisitorId()` returns `{ data, isLoading, error }` accessible without `$` prefix). Current store-based API will remain available for backward compatibility.

## SSR (SvelteKit)

- Server: `Tracio.init` returns a stub instance (SDK SSR guard). Stores stay in `isLoading: true`.
- Client: `Tracio.init` bootstraps the script + result; stores update via `writable.set`.

Wrap `Tracio.init` in `if (browser)` from `$app/environment` to skip the server call entirely.

## Example

Runnable Vite + Svelte app: [`../examples/svelte`](../examples/svelte).

## License

MIT
