# Contributing to the Tracio SDK

The `@tracio/*` packages (`sdk`, `react`, `vue`, `angular`, `svelte`) live in an
independent pnpm workspace. This directory is the **source of truth**; the public
[`Tracio-App/sdk`](https://github.com/Tracio-App/sdk) repository is a read-only,
provenance-published snapshot — it is force-synced on each release and does not
accept pushes. Open issues there, but send code changes through the internal
workspace.

## Prerequisites

- **Node ≥ 18** (CI runs Node 22).
- **pnpm 10** — install globally (`npm install -g pnpm@10.34.5`); do **not** use corepack
  (it drifts the lockfile / `pnpm-workspace.yaml`).

> **Bumping the pnpm major?** Also bump the CI cache key in
> `bitbucket-pipelines.yml` (`pnpm-store-v10` → `pnpm-store-v11`, …). That cache
> holds the virtual store (`node_modules/.pnpm`), whose layout is not compatible
> across majors, and its key is derived from `pnpm-lock.yaml` — which a major
> upgrade may leave untouched (9 → 10 did: both write `lockfileVersion 9.0`).
> Without the bump CI restores a store the new pnpm cannot read and fails with
> `ENOENT` on a package manifest.

```bash
cd packages
pnpm install --frozen-lockfile
```

## Quality gates

Every change must pass the full gate suite before it can be released. Run it
locally exactly as CI does:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test \
  && pnpm attw && pnpm publint && pnpm size-limit && pnpm test:ssr
pnpm --filter @tracio/sdk exec playwright install chromium   # once
pnpm test:e2e
pnpm changeset status --since=origin/development             # on a branch
```

- `format:check` — Prettier over every `ts/tsx/vue/svelte/md/json` file.
- `lint` — `eslint --max-warnings=0` (warnings fail).
- `test` — Vitest **with coverage**; each package's `vitest.config.ts` holds thresholds
  that fail the run.
- `typecheck` — `tsc --noEmit`.
- `publint` / `attw` — package-manifest + published-types correctness (`--strict`).
- `size-limit` — per-package brotli budgets (ESM / CJS / CDN-IIFE).
- `test:ssr` — imports both module formats under Node to prove SSR-safety.
- `test:e2e` — Playwright (Chromium) against the built `dist/`: the CDN/IIFE bundle and the
  real `<script>` injection, which the happy-dom unit tests cannot reach. A separate CI lane.
- `changeset status` — a PR that changes a published package must carry a changeset
  (see below); CI runs it against the PR's destination branch.

The published surface is **English-only**: `src/`, `README.md` and `CHANGELOG.md` of
every published package, and every pending `.changeset/*.md` (it becomes the CHANGELOG),
must not contain Cyrillic. CI checks it before install:

```bash
grep -rlnP '[\x{0400}-\x{04FF}]' sdk/src sdk/README.md sdk/CHANGELOG.md .changeset/*.md README.md
```

(GNU grep; the CI step derives the package list from `package.json` and skips
`private` packages and `.changeset/README.md`.)

## Changesets

Any user-visible change to a public package needs a changeset:

```bash
pnpm changeset
```

Pick the affected packages, choose the bump level, and describe the change in the
imperative. A change that needs no release (tests, tooling) still declares it:
`pnpm changeset --empty`. Keep the wrappers' peer range on `@tracio/sdk` wide
(`>=0.1.4 <1.0.0`): a new core version outside a wrapper's peer range makes changesets
bump that wrapper to `major`, and the lock-step config spreads it to all five — a core
`minor` once came out as `1.0.0` this way. The release pipeline refuses an unplanned
major unless the run sets `SDK_RELEASE_ALLOW_MAJOR=1`. The five public packages are versioned **lock-step** (`fixed` config):
bumping one bumps all five. The release itself is cut from `master` via the manual
`sdk-release` Bitbucket pipeline (`changeset version` → tag → mirror → publish). After a
failure, start a **new** `sdk-release` run on the current `master` — it tags a version
that reached `master` untagged. Do not use "Rerun" on the failed step: it builds the old
commit, and its push to `master` is rejected as non-fast-forward. Publishing uses npm trusted publishing (OIDC) from the mirror — there is
no npm token, and `prepublishOnly` refuses a tarball without `dist/`.

## Coding conventions

- TypeScript, ESM-first; keep the dual ESM+CJS build green.
- Maintain wrapper parity — a capability added to one framework wrapper should have
  an equivalent in the others where it makes sense.
- Add or update tests with every behavioral change.

## Reporting security issues

Do **not** open public issues for vulnerabilities — see [SECURITY.md](./SECURITY.md)
(`security@tracio.ai`, coordinated disclosure).
