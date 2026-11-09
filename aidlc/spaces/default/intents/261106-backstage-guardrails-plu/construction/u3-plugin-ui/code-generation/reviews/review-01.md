## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-09
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | packages/plugin-guardrails/scripts/check-built.mjs (lines 20, 43, 46) and packages/plugin-guardrails/scripts/check-packages.mjs (lines 26, 32) | `yarn workspace plugin-guardrails lint` (the command the new CI `lint` step runs) fails with 5 `no-console` errors in the two scripts. code-summary.md says "Prettier and ESLint ... are clean for the package", which is false. The team rule is that CI must be green before merge, so the first pull request would be blocked by the lint job. | Allow console output in `scripts/**` (an override in `.eslintrc.js`) or write to `process.stderr`/`process.stdout`. Re-run lint to zero errors and correct the lint claim in code-summary.md. | New |
| R-02 | Minor | packages/plugin-guardrails/src/api/demoSession.ts > `refresh()` and packages/plugin-guardrails/src/api/guardrailsApi.ts > `send()` | When several section reads get 401 at once, each calls `refresh()` and each makes its own sign-in start call (no shared in-flight refresh). Functionally correct, but it multiplies start calls and can overwrite `token` out of order. | Share one in-flight refresh promise among concurrent callers. | New |
| R-03 | Minor | packages/plugin-guardrails/package.json > dependencies; code-summary.md > Deviations item 4 | `@backstage/core-components` and `@backstage/core-plugin-api` are declared and allow-listed but not used. The code-summary discloses this honestly. | Remove both and their allow-list lines, or record an owner and date for the clean-up. | New |
| R-04 | Minor | .github/workflows/ci.yml > `ui-build` / `ui-checks`; packages/plugin-guardrails/package.json > scripts.build | `build` is plain `tsc` output, not a bundle, so the 300 KB gzip gate and the "no address in code" scan measure unbundled sources and not what the app ships. | Note that the gate is provisional until u4 builds the app, and add the app-package build step to `ui-build` then. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `yarn workspace plugin-guardrails test --coverage` | PASS: 19 suites, 312 tests; lines 97.91%, statements 97.21%, branches 93.3%, functions 96.47% | Matches code-summary.md. The 85% line threshold is in package.json jest settings and was not lowered. `testing/` and test files are excluded from collection. |
| `yarn workspace plugin-guardrails lint` | FAIL: 5 errors (`no-console` in the two scripts) | Basis for the Critical finding. |
| `yarn tsc -p packages/plugin-guardrails` (the CI typecheck command) | PASS | Clean. |
| `yarn workspace plugin-guardrails check:packages` | PASS: 22 declared packages allowed | OK. |
| traceability.json check | All 92 upstream ids covered; 87 OK, 5 Deferred (AC1.1.3, AC1.2.3, AC4.1.5, NFR1.1, BR7.5 to u5, as the code-summary says); every OK target path exists | Targets are true. Deviations in code-summary.md read as honest and complete, except the lint claim. |
| Code review of API, session, GuardedButton, useSection, ReasonField, security tests | The token lives only in a private `DemoSession` field and is sent only as the `Authorization` header; only the userId is stored. Addresses are encoded with `encodeURIComponent`. Read limit is 5 s, write limit 12 s. A write is never repeated after a 401. A stale answer is dropped by a load counter and abort. GuardedButton uses aria-disabled, stays focusable, ignores a second press, and shows "Working...". The reason box stops at 500 characters. Lint rules forbid raw HTML, `fetch` and storage outside `src/api`. | Controls S1-S5 and P-decisions are implemented. The security tests assert real behavior (recorded requests, token search, storage contents). CI jobs `ui-unit`, `ui-coverage`, `ui-contract`, `ui-build` and `ui-checks` match cicd-pipeline.md. |

### Summary

The implementation matches the design: the security controls, time limits, stale-answer drop and GuardedButton behavior are real, the 312 tests are meaningful, coverage is 97.9% against an 85% floor, and the traceability targets resolve. It is not ready because the package's lint fails with 5 `no-console` errors in the build-check scripts, which would turn the mandated CI lint job red, and code-summary.md wrongly says lint is clean. This is a small fix.
