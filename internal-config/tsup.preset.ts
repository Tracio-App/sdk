import type { Options } from "tsup";

export const basePreset: Options = {
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  // Single source-map directive (N10): keep `sourcemap: true` but do NOT enable
  // tsup's `treeshake` option. tsup's treeshake runs a second rollup pass on top
  // of esbuild and re-appends a `//# sourceMappingURL` directive that esbuild has
  // already written, producing a DOUBLED `//# sourceMappingURL` comment in every
  // output file. esbuild's own tree-shaking (always on when bundling ESM) already
  // drops dead code — measured smaller output than the extra rollup pass — so we
  // rely on it and leave `treeshake` off to guarantee exactly one directive.
  // Likewise do not set esbuildOptions.sourcemap in a consumer override: that
  // also yields a second directive.
  sourcemap: true,
  clean: true,
  minify: false,
  splitting: false,
  outDir: "dist",
  target: "es2022",
  external: [],
};

/**
 * Build a tsup config from the shared preset.
 *
 * Footgun fix (L33): a naive `{ ...base, ...overrides }` shallow-merge makes a
 * consumer's `external`/`plugins` REPLACE the preset's arrays entirely. That is
 * harmless while the preset's `external` is empty, but it is a latent trap: the
 * moment the preset adds a baseline `external` entry, any wrapper that passes
 * its own `external` would silently bundle whatever the preset meant to keep
 * out (e.g. a peer framework getting inlined into the published bundle).
 *
 * To make the contract intention-preserving, array fields that are meant to be
 * *additive* (`external`, `plugins`) are concat-merged with the preset's values
 * (string entries de-duplicated), instead of being overwritten. Every other
 * field keeps last-write-wins shallow-merge semantics.
 */
export function withPreset(overrides: Partial<Options> = {}): Options {
  const merged: Options = { ...basePreset, ...overrides };

  // Concat-merge additive array fields so a consumer's entries augment, rather
  // than clobber, the preset's. De-dup only string entries (a RegExp has no
  // stable identity to compare on, so we keep them all).
  const mergeArray = <T>(a: T[] | undefined, b: T[] | undefined): T[] => {
    const seen = new Set<string>();
    return [...(a ?? []), ...(b ?? [])].filter((item) => {
      if (typeof item !== "string") return true;
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  };

  if (Array.isArray(basePreset.external) || Array.isArray(overrides.external)) {
    merged.external = mergeArray(
      basePreset.external as unknown[] | undefined,
      overrides.external as unknown[] | undefined,
    ) as Options["external"];
  }

  if (basePreset.plugins || overrides.plugins) {
    merged.plugins = mergeArray(basePreset.plugins, overrides.plugins);
  }

  return merged;
}
