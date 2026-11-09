## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-09T11:12:21Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | packages/backend/src/startup.test.ts > test 'refuses the user list with the switch off' and test 'signs a chosen demo user in' | `app-config.yaml` ships `auth.providers.demo: {}` unconditionally, and the plugin module registers the provider only when the switch is on. The start-up test proves the user list is refused with the switch off, but no test calls `/api/auth/demo/start?userId=...` with the switch off. Nothing in this unit shows that an always-present `demo` config entry without a registered provider cannot let anyone sign in. That is the central claim of NFR5.2 and BR2.1. | Add a start-up test with `demo: false` that calls `/api/auth/demo/start?userId=priya` and asserts a refusal (no 200 and no token). If the auth backend does not refuse, fix the settings or the wiring. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u4-backstage-app/nfr-design/security-design.md > S9, and packages/backend/app-config.yaml > backend.csp.script-src | The shipped content policy allows `'unsafe-eval'` for scripts. The approved S9 text and plan step 6 say "no `unsafe-eval`". The deviation is honestly listed in code-summary.md and the README, and S9 itself allows a looser directive with a note. The cause was seen in a real browser run (EvalError on the entity page). The summary leans on the earlier "defaults plus an explicit policy" answer as if it allowed this, which it does not clearly do. The settings check does keep `unsafe-eval` out of every other directive and keeps wildcards out. | Have the person accept the deviation explicitly at the gate. Update S9 and the NFR text to match the shipped policy so the design and the settings no longer disagree. | New |
| R-03 | Minor | packages/backend/src/startup.test.ts > test 'never allows the origin of another site'; packages/backend/app-config.yaml > backend.cors and backend.csp | The CORS allow-list and the content-policy header are not asserted by any test in this unit. The test backend sends neither header, so the settings test only reads the YAML. The summary lists this as a hand-off to u5. | Keep the hand-off in u5's plan, with explicit assertions for `Access-Control-Allow-Origin` equal to the app address and for the full `Content-Security-Policy` header. | New |
| R-04 | Minor | packages/backend/package.json > jest.collectCoverageFrom; packages/app/package.json > jest.collectCoverageFrom | The exclusions are index files, `App.tsx`, `setupTests`, the `src/scripts` wrappers, `testing/` and `lintFixtures/`. They are disclosed and do not hollow out logic: the coverage threshold stays at 85%, and the real checks (`checkShippedSettings`, `buildCatalog`, `startEnv`) are covered. In the backend run that skips the start-up test, `features.ts` shows 0%, and the global figure (96.49%) still clears the floor. | No change needed. Optionally add `--testPathIgnorePatterns` notes to the CI job comment so nobody reads the 0% on `features.ts` as a gap. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u4-backstage-app/code-generation/code-summary.md > Deviations 2 and 9 | The build was done in the main session, not by the developer agent. The summary states this openly, and also states two process slips (a one-off script edit and a stray file in the system temp folder). The effect on the code is nil, but the test-first red-run evidence is self-reported. | Person to weigh at the gate. The red-run table gives plausible module-not-found outputs. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `yarn workspace app test --watchAll=false --coverage` | 6 suites, 36 tests pass. Line coverage 97.76%. | Above the 85% floor. The uncovered lines are `signInModule.tsx` 45-49 and `signInState.ts` 70. |
| `yarn workspace backend test --watchAll=false --testPathIgnorePatterns startup --coverage` | 7 suites, 30 tests pass. Line coverage 96.49%. | Above the floor. `features.ts` is 0% in this run, as the summary says. |
| `yarn workspace backend test --watchAll=false startup` | 1 suite, 10 tests pass. | The summary's count is confirmed. The tests make real assertions: status codes, headers, recorded log text and the token shape. |
| `yarn tsc` | Exit 0 (root, plugin and app). | Clean. |
| Hard-coded addresses (grep over `packages/app/src`, `packages/backend/src`, `packages/backend/scripts`) | The only hits are in the lint fixtures and in the settings check's local-host allow-list. | Addresses and ports come from the environment; the guardrails server address has no default. No secrets found in the shipped settings. |

### Summary

The implementation matches the plan and design. Tests are behavioral, coverage is above the unchanged 85% floor, nothing is hard-coded, and the deviations and u5 hand-offs are stated honestly. One gap is worth fixing before sign-off: no test proves that the sign-in start address refuses everyone when the demo switch is off, even though the `demo` provider entry is always present in the settings.
