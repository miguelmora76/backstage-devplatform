## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-08
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-design/security-design.md > Controls S1 and Credential Flow | The token flow assumes that `GET /api/auth/demo/start?userId=` returns JSON containing a token with a readable expiry claim, so that it can refresh 60 seconds before expiry. The C3 text in `contract-summary.md` only says the route "answers with the Backstage identity `user:default/<userId>`". Backstage auth start routes are normally redirect or popup flows. The response shape and the expiry claim are therefore not backed by the passed contract, and the refresh logic, the 401 replay and the S1 test all depend on them. | Record the token response shape (JSON field names, expiry source) as an explicit assumption owned by u2/C3. Either ask u2 to pin it in the contract, or give S1 a fallback that does not need an expiry claim (refresh only on 401). Add the shape to the msw stand-in contract check. | New |
| R-02 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-design/security-design.md > S1 versus S8 and Failure and Edge Behavior ("Stored userId no longer in the list") | S1 says that on page start a stored userId triggers a token request to the start path before the first call. S8 says the start path is never called with an id that is not in the `GET /demo-users` list, and the edge table removes a stale stored id only after the list is known. The design does not order these steps. As written, a stale or tampered stored id reaches the start path, or the list is awaited first. If the list is awaited first, that extra round trip is missing from the Load Sequence and from the NFR1.2 and NFR1.3 timing budgets. | Define the startup order: fetch `demo-users` (open route), validate the stored id, then fetch the token, then start the section loads. Show it in the Load Sequence diagram. Say whether the NFR1.2 700 ms test includes the session setup, or state that the budget is measured with a stored user absent. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-design/logical-components.md > Shared Resources ("at most six requests at once") | The count of six is header (2) plus sections (4). It leaves out the token request to the start path at startup and the aborted in-flight calls during a user switch (P4 reloads every section while old requests may still be open). | Restate the figure including the token request, or say that a switch aborts old calls before the new loads start. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-design/performance-design.md > P2 and Timeouts table (12 s write limit) | When the page's 12 s write limit ends a call, the backend may still finish the decision. The design shows `error.submitFailed` and makes the button usable again with the reason kept. A second press could then hit `ALREADY_DECIDED`, or send a duplicate propose. The outcome-unknown case is not designed. | After a write timeout, reload the open-changes section (and the detail view) so that the real state shows. Use wording that does not claim the write failed. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-design/security-design.md > S10 (build grep for `:d{2,5}`) | In minified output the pattern `:d{2,5}` matches ordinary object literals such as `{a:10}` and time-format strings. The check will give false positives and will be loosened or ignored. | Narrow the check to host:port shapes (for example `://` or `localhost` or `w:d{2,5}/`). Alternatively, run it on source files outside the constants file instead of the bundle. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-design/performance-design.md > Budgets ("Plugin code size") | NFR1.7 requires at most 300 KB compressed, but the design only prints the size at build. Nothing fails when the figure is exceeded. | Make the build script fail above 300 KB, or state that the figure is advisory and u5 enforces it. | New |
| R-07 | Suggestion | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u3-plugin-ui/nfr-design/security-design.md > S1 (401 handling) | A 401 can also mean the signed-in identity is a service principal, which C1 treats as `UNAUTHENTICATED`. A refresh would not help in that case. | Note that the single refresh applies only when a demo user was chosen. For the app's own credential, show `error.unauthenticated` directly. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Traceability check by hand (`traceability.json` against NFR1.1 to NFR1.7 and NFR5.1 to NFR5.12) | PASS: all 19 upstream IDs are present and map to existing P and S control IDs | No orphan IDs. The cross-references to P1 to P9 and S1 to S12 resolve. |
| Contract check against `contract-summary.md` (C1 timeouts of 3 s and 10 s, 401 `UNAUTHENTICATED`, `demo-users` open route, C3 start route) | Consistent, except the token response shape (Major 1) | The page timeouts of 5 s and 12 s sit above the backend limits and below the 30 s claim release. No C1 contradiction found. |
| Test runner or validators | Not run | This is a design-stage review and there is no code. |

### Summary

Every NFR1.x and NFR5.x has a concrete, testable control. There is no circular dependency, and the timeouts, failure domains and per-section isolation are sound. The two Major items are the unpinned demo-sign-in token response (a C3 gap) and the unordered startup between the stored-user token request and the user-list check. Both are fixable in the design text, and neither blocks implementation. The verdict is READY with two Major findings, which the people at the gate should weigh.
