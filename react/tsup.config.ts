import { defineConfig } from "tsup";
import { withPreset } from "@tracio/internal-config/tsup.preset";
import { writeFileSync, readFileSync } from "node:fs";

// esbuild strips bare string directives like "use client" when bundling.
// We inject it via onSuccess after all output files are written.
function prependUseClient(...files: string[]) {
  for (const file of files) {
    try {
      const content = readFileSync(file, "utf8");
      if (!content.startsWith('"use client"')) {
        writeFileSync(file, `"use client";\n${content}`);
      }
    } catch {
      // ignore — file may not exist (e.g. during DTS-only build)
    }
  }
}

export default defineConfig(
  withPreset({
    entry: ["src/index.tsx"],
    external: ["@tracio/sdk", "react", "react-dom"],
    async onSuccess() {
      prependUseClient("dist/index.js", "dist/index.cjs");
    },
  }),
);
