# @tracio/svelte

## 0.1.3

### Patch Changes

- 4f0f91e: fix(angular): build `@tracio/angular` in Angular Ivy partial-compilation mode

  The previously published `@tracio/angular` was bundled with tsup/esbuild +
  `experimentalDecorators`, shipping plain runtime `@Injectable()` decorators
  (`__decorateClass`) instead of Angular's Ivy _partial_ declarations. Consumers'
  default AOT builds then failed with `Error: JIT compiler unavailable`.

  The package is now built with **ng-packagr** in `compilationMode: partial`, so
  the published FESM2022 output contains `ɵɵngDeclareInjectable` /
  `ɵɵngDeclareClassMetadata` partial declarations and is fully AOT-consumable. No
  public API changed (`provideTracio` / `TracioService` are identical). The other
  SDK packages are bumped in lock-step (fixed version group) — they are unchanged.

- 9e286cf: fix(sdk): raise the default `getResult()` timeout from 8s to 15s. Fingerprint
  signal collection can exceed 8s on constrained devices/networks (and notably in
  headless/CI browsers), surfacing as a spurious `TracioError("timeout")`. 15s is a
  safer default; callers can still override `timeoutMs` either way.
- Updated dependencies [4f0f91e]
- Updated dependencies [9e286cf]
  - @tracio/sdk@0.1.3

## 0.1.2

### Patch Changes

- dc643da: fix: make `getResult()` actually resolve against the live edge. The loader called
  `window.Tracio.load().get()` synchronously, but the edge's `load()` returns a
  promise — so every call rejected with `TracioError("server")`. It now awaits
  `load()` before `get()`. The response mapping was also stale: the edge returns
  `{ canonical_uid, verdict, confidence (0–1), markers }`, not
  `{ visitor_id, request_id, bot:{...} }`. `TracioResult` now maps `visitorId` ←
  `canonical_uid`, `bot.detected` ← `verdict === "bot"`, `bot.confidence` ←
  `confidence × 100` (0–100), `bot.reasons` ← `markers`, and the unused `requestId`
  field (never present in the edge response body) is removed from `TracioResult`.
  The test edge double (`internal-test-utils`) now mirrors the real shape so the
  suite can no longer pass against an idealised contract that the edge never served.
- Updated dependencies [dc643da]
  - @tracio/sdk@0.1.2

## 0.1.1

### Patch Changes

- b77b37a: build: harden shared tsup preset (concat-merge external/plugins) and prune dead tsconfig options (declarationMap, emitDecoratorMetadata, duplicate test exclude)
- 1528782: chore: CI & release-config hygiene — fix changesets baseBranch, pin Node 22 across CI lanes, add changeset-status + test:ssr/format/lint publish gates, turbo lint ^build dep, and husky pre-push
- c8eb93f: sdk: reject getResult() on the server with a typed non_browser error (no more infinite hang), broaden the error taxonomy with retryable/terminal grouping, add an onError() channel that notifies late subscribers, defensively normalize partial bot wire-shapes, document bot.confidence as 0–100, and add optional region/linkedId/tag config seams.
- d16177a: Add LICENSE files, fix package.json metadata (peer deps, keywords, author), and consolidate size-limit budgets into per-package config.
- ebbe731: react: stop re-initializing the SDK on inline `config` re-renders, narrow caught errors via `isTracioError`, and add the FP-isomorphic `{ immediate }` / `getData()` / `isFetched` hook contract.
- d6348b2: Vue/Svelte/Angular wrapper parity: Vue plugin teardown on app.unmount, late-getResult cancellation, config-object form; Svelte per-tree context store (no module singleton), useTracio() escape hatch, real derived store; immediate/getData/getVisitorData imperative-fetch parity across all three.
- 61bcb9b: chore(release): re-tune size-limit budgets to post-fix actuals; use the bundled token-less changelog generator (no GITHUB_TOKEN required in the release lane)
- 8ab4bf6: feat(sdk): zero-build CDN bundle — minified IIFE (dist/index.min.js, global TracioSDK) + unpkg/jsdelivr fields
- ae094eb: docs/i18n: make the published SDK surface English-only and accurate. Translate the three runtime `TracioError` messages (`multiple_keys`, `blocked`, `load_failed`) and the `TracioConfig`/`TracioBotInfo` TSDoc to English; rewrite the `@tracio/sdk` README to match the current contract — `getResult()` rejects a typed `non_browser` error on the server (no hang), the full 10-code error taxonomy with `retryable`/`terminal` + `isTracioError`/`isRetryableError`, the `region`/`linkedId`/`tag` config seams, `onError()`, `bot.confidence` 0–100, a CDN `<script>` section (`TracioSDK.Tracio.init(...)`), an error-handling/adblock recipe, regenerated brotli size budgets, and a privacy/consent note. Ship `SECURITY.md` + `CONTRIBUTING.md` to the public mirror under `packages/`.
- 07221e5: api: re-export the error helpers as values from every framework wrapper. All four
  wrappers previously did `export type { TracioError }`, so `instanceof TracioError`
  and construction were erased at the package boundary and `isTracioError` /
  `isRetryableError` were unreachable. Each wrapper now value-re-exports
  `TracioError`, `isTracioError`, `isRetryableError` (plus the `TracioErrorCode`
  type) straight from `@tracio/sdk`, so consumers can narrow errors without also
  depending on `@tracio/sdk`. Also fix three README inaccuracies: `@tracio/svelte`
  is a store-based context provider (not a "Svelte 5 runes API" — that's the v0.2.0
  roadmap) and its `Tracio.init` is a per-tree context wrapper (not a re-export);
  `@tracio/angular`'s install line drops the unused `rxjs`.
- Updated dependencies [b77b37a]
- Updated dependencies [1528782]
- Updated dependencies [c8eb93f]
- Updated dependencies [d16177a]
- Updated dependencies [ebbe731]
- Updated dependencies [d6348b2]
- Updated dependencies [61bcb9b]
- Updated dependencies [8ab4bf6]
- Updated dependencies [ae094eb]
- Updated dependencies [07221e5]
  - @tracio/sdk@0.1.1
