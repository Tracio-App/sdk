import { defineConfig } from "tsup";
import { withPreset } from "@tracio/internal-config/tsup.preset";

export default defineConfig(
  withPreset({
    external: ["@tracio/sdk", "vue"],
  }),
);
