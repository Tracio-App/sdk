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

Plugin object — `app.use(TracioPlugin, config)`. Mounts the Tracio instance via provide/inject.

### `useTracio(): TracioInstance | undefined`

Escape hatch — raw `TracioInstance`. `undefined` outside the plugin scope or on SSR.

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
