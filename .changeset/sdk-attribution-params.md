---
"@tracio/sdk": minor
"@tracio/react": minor
---

feat: `attribution.params` — copy named landing-page URL parameters into custom fields

`Tracio.init({ attribution: { params: ["click_id", "aff_id"] } })` reads the listed
query parameters once at `init` and sends each as the field `aff.<name>`. Parameters
you do not list are never read. At most 10 names; the usual `fields` limits apply, and
an explicit `fields` entry with the same key wins. The values come from the URL and can
be forged, so verify them on your server. `TracioProvider` accepts the same
`attribution` prop.
