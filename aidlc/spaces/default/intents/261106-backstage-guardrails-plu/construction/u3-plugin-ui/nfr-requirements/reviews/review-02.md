## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-08T22:52:01Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-requirements/performance-requirements.md > NFR1.4 and NFR1.1 | NFR1.1 promises data, empty text or an error within 5 seconds, but NFR1.4 lets a read hang for 6 seconds and a write for 12 seconds before the page shows an error. The 6 s and 12 s limits have no source: the backend already ends reads at 3 s and writes at 10 s, and NFR1.4 does not show how 6 s follows from 3 s plus plugin and token-fetch time. A hung backend therefore breaks NFR1.1's own "or its error" wording. | Narrow NFR1.1 to "data or empty text; an error within the NFR1.4 limits", or lower the page read limit below 5 s, and record how the 6 s and 12 s values are derived from the backend's 3 s and 10 s. | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-requirements/security-requirements.md > NFR5.11 and tech-stack-decisions.md > NFR2.4 | NFR5.11 requires "no address, path ... in the plugin's code" and a built-plugin search that finds no host name or port. The plugin must still contain the C1 route paths and the C3 start address `/api/auth/demo/start?userId=`, so the check cannot pass as written. NFR2.4 names discovery only for the plugin backend. It does not say how the auth plugin's address is found for the start address, and u4 and u5 cannot tell what this unit expects. | Restrict NFR5.11 to host names, ports, tokens and user secrets, and allow relative route paths. In NFR2.4, state which discovery id resolves the start address (auth plugin) and whether the plugin builds `/demo/start` itself. | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-requirements/performance-requirements.md > NFR1.2 and NFR1.3 | The 300 ms and 700 ms test leaves out the serial work before the first read: the token fetch from the start address (NFR5.2, after a reload) and the header's `me` and demo-users calls. A reload with a stored userId is therefore not "slowest section, not the sum", and NFR1.1 on the compose run includes this extra step. | Add the token fetch to the NFR1.2 stand-in test, or state that it is a separate step with its own bound. | Unresolved |
| R-04 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-requirements/performance-requirements.md > NFR1.6 and NFR1.7 | The 1 s render figure and the 300 KB compressed size are invented without a source. NFR1.7 only says the size is "recorded", so it has no failing pass condition. A timing check in a simulated browser is also flaky in CI. | Make the 300 KB figure a build-failing budget, or call it a target that is only recorded. Say whether NFR1.6 blocks CI or is only logged. | Unresolved |
| R-05 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-requirements/tech-stack-decisions.md > NFR7.1 | "One fixed format" for dates and times names neither the format nor the time zone shown to a person. The functional design does not define it either. Rendering in the browser's local zone gives different screens on different laptops, which works against NFR7. | Name the date and time format and the display zone (for example UTC or browser-local), and state that the tests pin that zone. | Unresolved |
| R-06 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-requirements/security-requirements.md > NFR5.8 | The disabled-action test lists SERVER_UNREACHABLE, auditor, proposer, in progress and already current. The C1 reasons also include NOT_PENDING and NOT_FAILED, and the backend uses ALREADY_DECIDED. Those cases are not covered. | List every C1 disabled reason, or say the test iterates over all of them. | Unresolved |
| R-07 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-requirements/security-requirements.md > NFR5.2 and Accepted Risks | NFR5.2 covers only a reload with a stored userId. The first visit uses the app's own credential (DemoSession, BR5.2), and the document never says what the backend does with that credential when demo sign-in is off (u2 NFR5.2 refuses unknown identities). The accepted risks also omit that an in-memory token is still readable by any script (XSS) in the page. | State the first-visit and demo-off credential behavior and its expected backend answer, and add the in-page script exposure to the accepted risks. | Unresolved |
| R-08 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-requirements/security-requirements.md > NFR5.12 and tech-stack-decisions.md > New Packages | NFR5.12 limits new packages to the named ones, but the first row of New Packages is open-ended ("as needed"), so the lock-file check cannot fail. NFR2.1 to NFR2.12 are decisions numbered under NFR2 and are mapped as NFR2 coverage even though only NFR2.8 measures anything. | List the exact packages, and mark NFR2.1 to NFR2.7 and NFR2.9 to NFR2.12 as decisions in traceability.json (NFR2.8 is the measurable one). | Unresolved |
| R-09 | Suggestion | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-requirements/tech-stack-decisions.md > NFR3.4 and NFR4.1 | The split with u5 is honest and recorded (Q2: A). However, colour contrast, which NFR3 needs, is built only in u5, and traceability.json marks NFR3 and NFR4 as OK although this unit's tests cannot show them. | Mark NFR3.4 and NFR4.1 in traceability.json as covered by u5, so u5 planning picks them up as inputs. | Unresolved |

> R-01 Reviewer note: NFR1.4 now sets the read limit to 5 s (the NFR1 bound, above the backend's 3 s read timeout) and the write limit to 12 s (the backend's 10 s plus 2 s), and states that NFR1.1 applies while the plugin backend answers and that a hung backend ends at `error.loadFailed` at 5 s, still inside the bound. The limits now derive from the stated sources. The added 503-after-3-s test closes the gap between the backend timeout and the page timeout.

> R-02 Reviewer note: NFR5.11 now forbids host names, ports, user names, tokens and secrets and explicitly allows the relative C1 routes and the relative C3 start path. NFR2.4 names discovery for both the plugin backend (`guardrails`) and the auth backend (`auth`). The two requirements are now consistent and implementable.

> R-03 Reviewer note: NFR1.2 and NFR1.3 still leave out the token fetch and the me and demo-users calls.

> R-04 Reviewer note: The 1 s render and 300 KB figures are still unsourced, and NFR1.7 still has no failing condition.

> R-05 Reviewer note: NFR7.1 still does not name the date and time format or display zone.

> R-06 Reviewer note: NFR5.8 still omits NOT_PENDING, NOT_FAILED and ALREADY_DECIDED from the disabled-reason test list.

> R-07 Reviewer note: First-visit and demo-off credential behavior is still unstated, and in-page script exposure of the token is still missing from the accepted risks.

> R-08 Reviewer note: The "as needed" package row is still open-ended, and the NFR2.x decisions are still mapped as measurable requirements.

> R-09 Reviewer note: Contrast and browser checks are still marked OK although only u5 covers them.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| None listed for this stage | Not run | Review was by reading the changed requirements (NFR1.4, NFR5.11, NFR2.4) against the upstream timeouts in the contract summary as cited in the artifacts. |

### Summary

Both Major findings are fixed: the page timeouts now derive from the backend's 3 s and 10 s limits and sit consistently with NFR1.1, and the no-address rule now permits the contract's relative routes while naming both discovery ids. Only Minor items and one Suggestion remain open, none introduced by these changes, so the artifacts are implementable.
