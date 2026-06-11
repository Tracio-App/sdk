# Changesets

Add a changeset for any user-visible change to a public package:

```bash
pnpm changeset
```

Pick affected packages, choose bump level (patch/minor/major), describe the change.

The base branch is `development` (the dev mainline). Releases are **not** auto-generated:
a release is cut manually from `master` via the `sdk-release` Bitbucket pipeline, which runs
`changeset version` (bump + CHANGELOGs), pushes a `v<version>` tag, and mirrors `packages/`
to GitHub where `publish.yml` publishes to npm.

Lock-step: all five public packages are versioned together (`fixed` config). Bump one → bump all.
