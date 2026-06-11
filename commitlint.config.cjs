module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "perf", "refactor", "docs", "test", "build", "ci", "chore", "revert"],
    ],
    "scope-enum": [
      2,
      "always",
      ["sdk", "react", "vue", "angular", "svelte", "packages", "ci", "docs", "deps"],
    ],
  },
};
