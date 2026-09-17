# Contributing to the Tracio SDK

The `@tracio/*` packages (`sdk`, `react`, `vue`, `angular`, `svelte`) live in an
independent pnpm workspace. This directory is the **source of truth**; the public
[`Tracio-App/sdk`](https://github.com/Tracio-App/sdk) repository is a read-only,
provenance-published snapshot — it is force-synced on each release and does not
accept pushes. Open issues there, but send code changes through the internal
workspace.

## Prerequisites

- **Node ≥ 18** (CI runs Node 22).
- **pnpm 9** — install globally (`npm install -g pnpm@9`); do **not** use corepack
  (it drifts the lockfile / `pnpm-workspace.yaml`).

```bash
cd packages
pnpm install --frozen-lockfile
```

## Quality gates

Every change must pass the full gate suite before it can be released. Run it
locally exactly as CI does:

```bash
pnpm build && pnpm test && pnpm lint && pnpm typecheck \
  && pnpm publint && pnpm attw && pnpm size-limit && pnpm test:ssr
```

- `lint` — `eslint --max-warnings=0` (warnings fail).
- `typecheck` — `tsc --noEmit`.
- `publint` / `attw` — package-manifest + published-types correctness (`--strict`).
- `size-limit` — per-package brotli budgets (ESM / CJS / CDN-IIFE).
- `test:ssr` — imports both module formats under Node to prove SSR-safety.

The published surface is **English-only**: `src/` and every `README.md` must not
contain Cyrillic (CI greps for it). Error messages, TSDoc, and READMEs all cross
the package boundary into consumers.

## Changesets

Any user-visible change to a public package needs a changeset:

```bash
pnpm changeset
```

Pick the affected packages, choose the bump level, and describe the change in the
imperative. The five public packages are versioned **lock-step** (`fixed` config):
bumping one bumps all five. The release itself is cut from `master` via the manual
`sdk-release` Bitbucket pipeline (`changeset version` → tag → mirror → publish).

## Coding conventions

- TypeScript, ESM-first; keep the dual ESM+CJS build green.
- Maintain wrapper parity — a capability added to one framework wrapper should have
  an equivalent in the others where it makes sense.
- Add or update tests with every behavioral change.

## Reporting security issues

Do **not** open public issues for vulnerabilities — see [SECURITY.md](./SECURITY.md)
(`security@tracio.ai`, coordinated disclosure).
