# Tracio SDK Packages

Independent pnpm workspace for the Tracio frontend SDK family.

## Quick start

```bash
cd packages
pnpm install
pnpm build
pnpm test
```

## Packages

| Package               | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `@tracio/sdk`         | Vanilla JS core — typed loader for the per-key polymorphic edge runtime |
| `@tracio/react`       | React Provider + hooks                                                  |
| `@tracio/vue`         | Vue 3 plugin + composables                                              |
| `@tracio/angular`     | Angular standalone provider + signals service                           |
| `@tracio/svelte`      | Svelte context provider + stores                                        |
| `internal-config`     | Private — shared tsup / tsconfig presets                                |
| `internal-test-utils` | Private — `mockEdgeServer()` for tests                                  |

## Release

Lock-step versioning via [`@changesets/cli`](https://github.com/changesets/changesets) — all five public packages share one version line. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the release flow.
