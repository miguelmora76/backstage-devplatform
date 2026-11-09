## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-09
**Iteration:** 2
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Critical | packages/plugin-guardrails/scripts/check-built.mjs (lines 20, 43, 46) and packages/plugin-guardrails/scripts/check-packages.mjs (lines 26, 32) | `yarn workspace plugin-guardrails lint` (the command the new CI `lint` step runs) fails with 5 `no-console` errors in the two scripts. code-summary.md says "Prettier and ESLint ... are clean for the package", which is false. The team rule is that CI must be green before merge, so the first pull request would be blocked by the lint job. | Allow console output in `scripts/**` (an override in `.eslintrc.js`) or write to `process.stderr`/`process.stdout`. Re-run lint to zero errors and correct the lint claim in code-summary.md. | Resolved (reviewer) |
| R-02 | Minor | packages/plugin-guardrails/src/api/demoSession.ts > `refresh()` and packages/plugin-guardrails/src/api/guardrailsApi.ts > `send()` | When several section reads get 401 at once, each calls `refresh()` and each makes its own sign-in start call (no shared in-flight refresh). Functionally correct, but it multiplies start calls and can overwrite `token` out of order. | Share one in-flight refresh promise among concurrent callers. | Resolved (reviewer) |
| R-03 | Minor | packages/plugin-guardrails/package.json > dependencies; code-summary.md > Deviations item 4 | `@backstage/core-components` and `@backstage/core-plugin-api` are declared and allow-listed but not used. The code-summary discloses this honestly. | Remove both and their allow-list lines, or record an owner and date for the clean-up. | Resolved (reviewer) |
| R-04 | Minor | .github/workflows/ci.yml > `ui-build` / `ui-checks`; packages/plugin-guardrails/package.json > scripts.build | `build` is plain `tsc` output, not a bundle, so the 300 KB gzip gate and the "no address in code" scan measure unbundled sources and not what the app ships. | Note that the gate is provisional until u4 builds the app, and add the app-package build step to `ui-build` then. | Resolved (reviewer) |
| R-05 | Suggestion | packages/plugin-guardrails/src/e2e/performance.test.tsx > NFR1.6 render guard | The guard now uses the React Profiler's `actualDuration`. That cuts out wall-clock noise, but it measures only React render time, not layout or paint. The 1 second limit is unchanged, so it is a looser proxy than before for the user-visible target. | Optionally note in the test or unit-test-instructions that this is a render-time proxy. No change is needed to proceed. | New |
| R-06 | Suggestion | yarn.lock | `yarn.lock` is about 2,800 lines larger, because it now includes the new package's whole dependency tree. This is expected for a new package, but CI uses it. | Keep the existing CI lockfile check (frozen install) so the lockfile cannot drift. | New |

> R-01 Reviewer note: `.eslintrc.js` now turns off no-console for `scripts/**`. `yarn workspace plugin-guardrails lint` finishes with zero errors, and the code-summary claim that lint is clean now holds.

> R-02 Reviewer note: `DemoSession.refresh()` keeps one in-flight promise (`refreshing`) and clears it when the call settles. A new test, "shares one sign-in call between refreshes that run at the same time", covers it.

> R-03 Reviewer note: `@backstage/core-components` and `@backstage/core-plugin-api` are no longer in `package.json`, `allowed-packages.txt` or any source file under `src` or `scripts`.

> R-04 Reviewer note: code-summary.md now states that the 300 KB gate and the address scan run on the plugin's `tsc` output and are provisional until u4 builds the app. It also says the app build step is added to `ui-build` then.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| yarn workspace plugin-guardrails lint | PASS, zero errors | R-01 is fixed. |
| yarn workspace plugin-guardrails tsc --noEmit | PASS | Types are sound after the package removals. |
| yarn test (plugin-guardrails) | PASS: 19 suites, 313 tests | The refresh dedupe test and the Profiler-based guard pass. |

### Summary

All four prior findings are fixed, and the changes since pass 1 introduced no regressions. Lint, type check and the 313 tests are green, so this is READY. The two new items are suggestions only.
