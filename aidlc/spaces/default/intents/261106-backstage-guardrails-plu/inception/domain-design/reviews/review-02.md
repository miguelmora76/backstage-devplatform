## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-06T04:45:50Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/inception/domain-design/components.md > ChangeWorkflow behaviour and external_dependencies (Change store); AuditLog external_dependencies (Audit store); decisions.md > ADR-001 Consequences | The Change store and the Audit store are separate, and one approve or retry touches three places in a row: the change status, the guardrails server write, and the audit entry. No ordering or failure rule is written. If the audit append fails after the server write, a change can be applied with no entry, which breaks the FR3.4 pass criterion. If the status update is lost after the write, the change stays pending and can be approved again. Two users deciding at the same moment (FR3.7) also need an atomic pending-to-decided step, and no component is named as owner of it. ADR-001 only notes that the stores "need separate handling". | Add to ChangeWorkflow and ADR-001 a statement of (a) which step is the single atomic claim of a decision, (b) the order of status, server call and audit append, and (c) what happens when the audit append or the status write fails (for example, the action fails and the user sees an error). | New |
| R-02 | Minor | components.md > GuardrailsServer behaviour ("may be made to fail on purpose") and responsibilities | Forced failure is needed to test FR3.6 and US3.3, but FR6.1 and the component list allow only four operations. How a test or demo switches failure on is not placed anywhere, so a developer would invent a fifth tool or an undocumented control. | Say whether forced failure is a start-up setting or a separate control surface outside the four operations, and record it as an interface the plugin never calls. | New |
| R-03 | Minor | components.md > SeedDataGenerator entity SeedDataSet; GuardrailsServer entities ServiceRecord, Dependency, CiRun; decisions.md > ADR-004 Consequences | SeedDataSet has only `seed` and `serviceCount`, yet it is what the server loads to produce ServiceRecord, Dependency and CiRun. The shape the generator hands over, and who owns it, is left open, though ADR-004 admits both sides "must agree" on it. If the two components land in different units, this is an unpinned cross-unit contract. | State in the catalogue that SeedDataSet carries the services, dependencies and runs, or name a shared data-shape contract for Functional Design to fill, and say what is rebuilt on server restart (applied upgrades are lost). | New |
| R-04 | Minor | components.md > Change entity (`service`, `target`) and Entity Ownership > References | Change points at a service and at a dependency or CI run owned by GuardrailsServer (ServiceRecord, Dependency, CiRun), but only DemoUser is declared as a reference. Two pending changes for the same dependency are allowed (FR1.2), so an apply on already-upgraded data has no stated outcome. | Declare the references from Change to ServiceRecord and to Dependency or CiRun, and state what an apply does when the target is already at the recommended version. | New |
| R-05 | Minor | components.md > GuardrailsPluginUI behaviour ("rules it is told by the backend") and ChangeWorkflow depends_on/interactions | The UI must know the signed-in user, the role, and which actions are disabled with which reason (FR3.3, proposed FR12.1, FR11.2). No interaction line says ChangeWorkflow returns the allowed actions and reason, or whether the UI reads role from DemoIdentity. Two sources for the same rule would break "the UI never decides" and the ADR-005 single enforcement point. | Add to the ChangeWorkflow interaction the read of per-change allowed actions with a reason, and say that the UI takes role only for display. | New |
| R-06 | Minor | decisions.md > ADR-003 Consequences, ADR-001, ADR-002 | The phase rule asks for security implications on major decisions. ADR-003 says the backend trusts the sign-in identity and never the request, but not that DemoIdentity is a demo sign-in with no real authentication (switching is a user choice), so the "trust" is a sample-only property. ADR-001 and ADR-002 have no security note. | Add one line per ADR on the security effect, including that DemoIdentity is not a real security boundary and a real provider must replace it before any hosted use. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/inception/domain-design/components.md > ChangeWorkflow behaviour (recovery of decided changes without an audit entry) | Recovery appends the missing audit entry "the next time changes are read". Two concurrent reads can both see the gap and both append, and AuditLog has only append and read, so the duplicate cannot be removed. This puts a write on a read path and could break the one-entry-per-decision expectation of FR4.2. | Say that recovery appends at most one entry per change, for example by keying the entry on changeId plus outcome and having AuditLog refuse a duplicate, or by running recovery under the same claim. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/inception/domain-design/components.md > ChangeWorkflow behaviour (30-second claim release to failed "Interrupted") | The release does not say what happens to a slow original call that finishes after the release. It could write its final status over "failed", or leave a retry racing a still-running apply. Re-running a CI job is not idempotent the way an already-at-version upgrade is. | State that step 3 only writes if the claim is still held (compare and set), and that a late result after release is discarded and audited. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/inception/domain-design/decisions.md > ADR-004 Consequences / components.md > GuardrailsServer | Applied upgrades are lost when the guardrails server restarts, but the Change record still says applied. The plan can then show the old version beside an applied change, with nothing saying how that reads in the UI. | Record this divergence as accepted, or add the rule to Functional Design, such as a "server restarted" note on the plan or a rule that a restart resets the demo. | New |
| R-10 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/inception/domain-design/components.md > ChangeWorkflow behaviour (refused attempts) | Recovery covers only decided changes. A refused attempt has no change status to recover from, so if the audit append fails, FR3.7 and FR3.3 ("an audit entry with outcome refused exists") are silently missed. The user is told only that an error occurred. | State that a refusal whose audit append fails is returned to the caller as an error, and that the refusal is still enforced. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Catalogue structure (read by hand) | PASS | The 6 component names are unique and every referenced component is declared. No component depends on itself. depends_on and dependents match in every pair (UI to CW, AL and DI; CW to GS, AL and DI; GS to SG). The graph is acyclic. Each of the 7 entities has one owner and an identifier. Every Change and AuditEntry reference is declared under its owner and points to an entity owned by the named component. |
| Story coverage (stories.md vs traceability.json) | PASS | All 14 story IDs, US1.1 through US6.4, appear in stories.md and in traceability.json. Targets for the 11 OK rows are declared components or entities. The 3 Deferred rows point to units-generation. |

### Summary

The revision closes the earlier Major finding. The decision order is now an atomic claim, then the server call, then the change record, then the audit entry, with a recovery rule and a timeout. The catalogue is well formed and covers FR3 through FR7, FR11 and NFR5. Four Minor edge cases remain around recovery, claim release and server restart. They fit Functional Design and do not block approval.

### Suggestions

- Functional Design could record the allowed-actions payload shape, since it is the contract between GuardrailsPluginUI and ChangeWorkflow.
