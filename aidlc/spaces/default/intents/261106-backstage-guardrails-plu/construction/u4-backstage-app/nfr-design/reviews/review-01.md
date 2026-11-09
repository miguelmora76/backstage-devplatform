## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-09T10:28:11Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u4-backstage-app/nfr-design/reliability-design.md > State Handling (diagram and R5) | The design says it shows "the same machine as functional-spec.md" but it is not the same. The functional spec has LoadingUsers, Choosing, DemoOff, ListFailed, Starting and SignedIn, and a failed start goes Starting to Choosing with signin.failed. The design adds a SignInFailed state, renames LoadingUsers to Loading, and goes SignInFailed to Choosing on "try again". The R5 table test and the NFR3.1 per-state scan are specified against this different state set, so a developer gets two conflicting machines. | Make the design use the functional spec's states and transitions, with the failed start shown as Choosing plus the signin.failed text. If the extra state is wanted, change the functional spec first and say so. Fix the "same machine" sentence either way. | New |
| R-02 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u4-backstage-app/nfr-design/traceability.json > upstream_ids and coverage | Coverage lists only 21 IDs. The documents claim to meet NFR1.7, NFR1.8, NFR1.9 (O1 to O3, O6), but those IDs are not in the file. NFR3.1 to NFR3.3 (WCAG scan per state, keyboard use, accessible names) have no design pattern at all in the five documents, although the requirements say this unit tests them. NFR2.5 (settings check), NFR6.1 (lint and format in CI) and NFR2.4 are also missing as IDs. A stage that lists "OK" for 21 IDs while accessibility and observability are absent hides a gap. | Add the missing IDs to upstream_ids and coverage with their targets. Add a short accessibility design (real buttons, a live region for loading and error states, focus after Retry, jest-axe per state) to the design documents, or record the requirement as covered elsewhere with the reason. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u4-backstage-app/nfr-design/security-design.md > S1 and S2 | S1's test requires `demo` to be the only key under `auth.providers` in the shipped settings, while S2 says D8 (whether that entry is needed at all) stays open. If Code Generation finds no entry is needed, S1's test asserts something that may not exist. | State S1's settings check so it passes both ways: no provider other than `demo` under `auth.providers`, and `demo` present only if D8 requires it. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u4-backstage-app/nfr-design/security-design.md > S2 | The setting is written as `${GUARDRAILS_DEMO_SIGN_IN}` with the default false "written as a setting-check rule, not a literal". The security requirement wants the shipped settings to default to false. A bare substitution with no default is unset, not false, and the sentence does not say how an unset variable becomes off. | Say how the default is carried (for example `${GUARDRAILS_DEMO_SIGN_IN:-false}` if supported, or the plugin treating unset as false) and name the test that proves an unset variable gives the off behavior. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u4-backstage-app/nfr-design/security-design.md > S9 | The policy is described as allowing styles from `'self'` and the backend address only. Material UI version 4 injects inline style tags, which Backstage's default policy permits with `unsafe-inline` for styles. A `'self'`-only style rule would likely break rendering. The unit hands the check to u5, but the design text as written points the wrong way. | Say that the style directive keeps whatever Backstage's default allows for inline styles, and that the "no unsafe-eval, no wildcard host" rule applies to scripts and connections. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u4-backstage-app/nfr-design/security-design.md > S4 | The lint rule that fails on string literals matching `:d{2,5}` will hit time strings, ratios and similar text in `packages/app/src` and `packages/backend/src`. | Narrow the pattern to host and port forms (for example `://` or `localhost:`), or list the allowed exceptions. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual cross-reference of NFR IDs against `nfr-requirements/traceability.json` and the requirement files | NFR1.7 to NFR1.9, NFR3.1 to NFR3.3, NFR2.5, NFR6.1 not in design coverage | See the traceability and accessibility finding |
| Manual state comparison against `functional-spec.md` State Machines | One extra state and one renamed state in the design | See the first finding |
| Snippet length rule | No code blocks over 15 lines; no full implementations | Pass |

### Summary

The design is mostly implementable, achievable and consistent on the 5 s limits, the strings, D8 left open and the shared feature list. Two Major gaps remain to settle before Code Generation: the sign-in state machine differs from the functional spec, and the traceability file leaves out observability and accessibility requirements. That is within the READY limit of two Major findings, but both should be fixed at the gate.
