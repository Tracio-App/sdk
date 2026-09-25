# Security Policy

Tracio publishes provenance-signed SDK packages used for bot detection and
device fingerprinting. We take the security of these packages — and the data
they handle — seriously. Thank you for helping keep Tracio and its users safe.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public issue trackers,
pull requests, or any public channel.**

Instead, report them privately to:

- **security@tracio.ai**

Include as much of the following as you can:

- The affected package(s) and version(s) (e.g. `@tracio/sdk@0.1.0`).
- A description of the vulnerability and its impact.
- Steps to reproduce, a proof-of-concept, or a minimal failing example.
- Any suggested remediation, if you have one.

We will acknowledge your report within **3 business days** and aim to provide a
remediation timeline after triage. We will keep you informed of progress and
will credit you in the release notes once a fix ships, unless you prefer to
remain anonymous.

Please give us a reasonable window to investigate and release a fix before any
public disclosure (coordinated disclosure).

## Supported Versions

Security fixes are applied to the latest released minor of each published
`@tracio/*` package. The five public packages are released lock-step (one
shared version line), so a fix ships to all of them together.

| Package           | Supported                 |
| ----------------- | ------------------------- |
| `@tracio/sdk`     | :white_check_mark: latest |
| `@tracio/react`   | :white_check_mark: latest |
| `@tracio/vue`     | :white_check_mark: latest |
| `@tracio/angular` | :white_check_mark: latest |
| `@tracio/svelte`  | :white_check_mark: latest |

Older versions are not patched; please upgrade to the latest release to receive
security fixes.
