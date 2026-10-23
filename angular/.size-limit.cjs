// Budget is brotli-compressed bytes. The single size-limit config of this
// package: it used to live under the `size-limit` key of package.json, which
// size-limit reads before this file, so the gzip budget kept here was never
// applied. Peers are ignored — the budget measures the wrapper, not Angular.
module.exports = [
  {
    name: "@tracio/angular (FESM2022)",
    path: "dist/fesm2022/tracio-angular.mjs",
    limit: "3.0 KB",
    import: "{ provideTracio, TracioService }",
    ignore: ["@angular/core", "@angular/common", "@tracio/sdk", "rxjs", "tslib"],
  },
];
