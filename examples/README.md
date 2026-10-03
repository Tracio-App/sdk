# Tracio SDK examples

Runnable, self-contained consumer apps — one per published package. Each depends on the **published**
npm packages (`@tracio/sdk` + the framework wrapper at `^0.1.2`), **not** on the workspace sources.
They are intentionally **not** pnpm-workspace members, so the package CI gates
(`build` / `test` / `lint` / `typecheck` / `format:check`) never touch them.

| Example | Package | Stack |
| --- | --- | --- |
| [`sdk/`](./sdk) | `@tracio/sdk` | Static HTML + CDN (no build) |
| [`react/`](./react) | `@tracio/react` | Vite + React 19 |
| [`vue/`](./vue) | `@tracio/vue` | Vite + Vue 3 |
| [`svelte/`](./svelte) | `@tracio/svelte` | Vite + Svelte 5 |
| [`angular/`](./angular) | `@tracio/angular` | Vite + Angular 20 (Analog plugin) |

## Run any example

```bash
cd <example>      # e.g. cd react
npm install
npm run dev
```

(The `sdk/` CDN example has no build — see its README for `npx serve .`.)

Each example reads a `PUBLIC_KEY` / `ENDPOINT` constant near the top of its entry file. Replace the
placeholder key with your own from the Tracio dashboard (Settings → API keys). The committed value is
a shared dev key pointing at `https://edge.tracio.dev`.
