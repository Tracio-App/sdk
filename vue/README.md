# @tracio/vue

Vue 3 plugin + composables for the Tracio bot detection SDK.

## Install

```bash
npm install @tracio/vue @tracio/sdk
```

(Vue 3.4 or later must be installed separately.)

## Quick start

```ts
// main.ts
import { createApp } from "vue";
import { TracioPlugin } from "@tracio/vue";
import App from "./App.vue";

createApp(App)
  .use(TracioPlugin, { publicKey: import.meta.env.VITE_TRACIO_KEY })
  .mount("#app");
```

```vue
<!-- AnyComponent.vue -->
<script setup lang="ts">
import { useVisitorId } from "@tracio/vue";

const { data: visitorId, isLoading, error } = useVisitorId();
</script>

<template>
  <span v-if="isLoading">Loading…</span>
  <span v-else-if="error">Error: {{ error.message }}</span>
  <span v-else>Visitor: {{ visitorId }}</span>
</template>
```

## API

### `TracioPlugin`

Plugin object — `app.use(TracioPlugin, config)`. Mounts the Tracio instance via provide/inject
and destroys it when the app unmounts.

`config` is the core [`TracioConfig`](https://www.npmjs.com/package/@tracio/sdk#tracioinitconfig-tracioconfig-tracioinstance) — every field (`publicKey`, `endpoint`, `linkedId`,
`linkedIdSig`, `tag`, `fields`, `timeoutMs`, …) is passed to the core as is; semantics and limits
are in the core README. `app.use(TracioPlugin, { config })` is accepted too.

The config is read **once**, at `app.use`. Mutating it later — including a `reactive()` object —
changes nothing: the live instance keeps the config it was created with. To apply a new
`linkedId` or `fields` (after login, say), unmount the app and mount a new one with
`app.use(TracioPlugin, newConfig)`: unmounting destroys the old instance, and the composables
of the new app see the new one.

### `useTracio(): TracioInstance | undefined`

Escape hatch — raw `TracioInstance` (not a wrapper object, unlike React's `{ tracio, unavailable }`). `undefined` outside the plugin scope.

### `useVisitorId(opts?): { data, isLoading, error, isFetched, getData }`

- `data: Ref<string | null>`
- `isLoading: Ref<boolean>`
- `error: Ref<TracioError | null>`
- `isFetched: Ref<boolean>` — true once the fetch has settled
- `getData(): Promise<void>` — imperatively (re)fetch

Pass `{ immediate: false }` to skip the on-mount fetch and call `getData()` yourself.

### `useTracioResult(opts?): { data, isLoading, error, isFetched, getData }`

Same shape; `data` is `Ref<TracioResult | null>`.

## SSR (Nuxt / Vite SSR)

- Server: `onMounted` doesn't fire; `data` stays `null`, `isLoading` stays `true`.
- Client: hydration triggers `onMounted` → instance is created, result fetched.

## Example

Runnable Vite + Vue app: [`../examples/vue`](../examples/vue).

## License

MIT
