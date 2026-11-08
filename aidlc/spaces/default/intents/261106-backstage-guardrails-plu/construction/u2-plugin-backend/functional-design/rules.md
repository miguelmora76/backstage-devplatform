# Rules — u2-plugin-backend

Sources: `requirements.md` (FR1–FR5, FR11, NFR1, NFR5), `stories.md` (US1.1, US1.2, US2.1, US2.2, US3.1–US3.3, US4.1, US5.1, US5.2), `components.md` (ChangeWorkflow decision order and recovery), `contract-summary.md` (contracts C1 and C2, and its open review points R-01 to R-07), the refined mockups' changes P1–P5 and answers Q1–Q7 in `functional-design-questions.md`. The YAML block is the source of truth; the table after it is a summary.

```yaml
rules:
  - id: BR1.1
    statement: The actor and the role of every request come from the sign-in identity only.
    category: authorization
    applies_to: all routes
    trigger: Any request
    logic: "IF a request carries an actor or role in its body, query or headers THEN those values are ignored. The actor is the DemoUser the sign-in identity (user:default/<userId>) names, and the role is that user's fixed role."
    violation: A request whose identity names no demo user is refused (BR1.3).
    source: FR5.2, P5
  - id: BR1.2
    statement: Three demo users with fixed roles exist.
    category: constraint
    applies_to: DemoUser
    trigger: The backend starts
    logic: "IF the backend starts THEN the users are sam (service owner), priya (platform engineer) and alex (auditor), and the list can be read so the UI can offer the switch."
    violation: A different set or role is a defect.
    source: FR5.1
  - id: BR1.3
    statement: A request without a valid demo identity is refused and writes nothing.
    category: authorization
    applies_to: all routes
    trigger: A request arrives with no identity or an unknown one
    logic: "IF the identity is missing or names no demo user THEN refuse with 401 and write nothing, not even an audit entry, because there is no actor to record."
    violation: Serving the request is a defect.
    source: FR5.2, P5
  - id: BR1.4
    statement: The auditor can read but never write.
    category: authorization
    applies_to: propose, approve, reject, retry
    trigger: A write request from a user whose role is auditor
    logic: "IF the actor's role is auditor THEN every propose, approve, reject and retry is refused with AUDITOR_READ_ONLY. The service owner and the platform engineer may propose and retry, and may approve or reject any change they did not propose."
    violation: An auditor write that succeeds is a defect.
    source: FR12.1 (proposed), P1

  - id: BR2.1
    statement: A proposal creates a pending change and an audit entry.
    category: policy
    applies_to: propose
    trigger: An eligible proposal from a user who may propose
    logic: "IF an upgrade or re-run is proposed for an eligible target THEN create a Change with status pending, the proposer, the summary written now (BR2.6) and proposedAt, and append an audit entry with action propose and outcome proposed, no reason, the changeId and decisionNumber 0."
    violation: A change without its audit entry is repaired by recovery (BR7.4).
    source: FR1.2, FR2.2, P2
  - id: BR2.2
    statement: Proposing again while a pending change exists creates a separate pending change.
    category: policy
    applies_to: propose
    trigger: A proposal for a target that already has a pending change
    logic: IF a pending change exists for the same service and target THEN the new proposal still creates its own pending change and both are listed.
    violation: Refusing or merging the proposal is a defect.
    source: FR1.2, FR2.2
  - id: BR2.3
    statement: Only a target that needs the change can be proposed.
    category: validation
    applies_to: propose
    trigger: A proposal
    logic: "IF the service, dependency or run does not exist on the guardrails server THEN refuse with NOT_FOUND and write nothing. IF an upgrade is proposed for a dependency whose current version already equals its recommended version, or a re-run for a run that is not currently failed, THEN refuse with NOT_ELIGIBLE (409) and write nothing. The allowed actions on a plan row show the reason ALREADY_CURRENT for the first case."
    violation: Creating a change for such a target is a defect.
    source: FR1.2, FR2.2, Q4
  - id: BR2.4
    statement: A proposal by an auditor is refused and recorded.
    category: authorization
    applies_to: propose
    trigger: Propose by a user with role auditor
    logic: IF the actor is an auditor THEN refuse with AUDITOR_READ_ONLY and append an audit entry with action propose, outcome refused and no change id.
    violation: Creating a change is a defect.
    source: FR12.1 (proposed), P1
  - id: BR2.5
    statement: A proposal needs the guardrails server to answer.
    category: constraint
    applies_to: propose
    trigger: A proposal while the server cannot be asked
    logic: "IF the backend cannot read the plan or the failed runs to check the target (no answer in time, or any tool error) THEN refuse with SERVER_UNREACHABLE (503) and write nothing."
    violation: Creating a change without checking the target is a defect.
    source: FR11.2
  - id: BR2.6
    statement: The text of what a change will do is written once, when it is proposed.
    category: policy
    applies_to: Change
    trigger: A proposal
    logic: "IF a change is created THEN its summary is built from the server's data at that moment (for example the dependency name with its current and recommended versions, or the run number and cause) and never changed afterwards."
    violation: A summary that changes later is a defect.
    source: FR3.1, Q7

  - id: BR3.1
    statement: Approve, reject and retry need a reason, and an empty reason writes nothing.
    category: validation
    applies_to: approve, reject, retry
    trigger: A decision request
    logic: "IF the reason is empty or only whitespace THEN refuse with EMPTY_REASON (400) and write nothing: no change update and no audit entry. The reason that is stored is kept exactly as submitted, without trimming."
    violation: Writing anything on an empty reason is a defect.
    source: FR3.2, FR3.6
  - id: BR3.2
    statement: An auditor cannot decide.
    category: authorization
    applies_to: approve, reject, retry
    trigger: A decision by a user with role auditor and a non-empty reason
    logic: IF the actor is an auditor THEN refuse with AUDITOR_READ_ONLY, leave the change unchanged and append an audit entry with outcome refused and the reason as submitted.
    violation: An auditor decision that takes effect is a defect.
    source: FR12.1 (proposed), P1
  - id: BR3.3
    statement: A person cannot decide a change they proposed.
    category: authorization
    applies_to: approve, reject, retry
    trigger: A decision by the proposer
    logic: IF the actor is the change's proposer THEN refuse with SELF_DECISION, leave the change unchanged and append an audit entry with outcome refused and the reason as submitted. A different user who is not an auditor may decide.
    violation: A self-decision that takes effect is a defect.
    source: FR3.3
  - id: BR3.4
    statement: Every decision follows one fixed order.
    category: policy
    applies_to: approve, reject, retry
    trigger: A decision that passed the earlier checks
    logic: "(0) Before the claim, repair any missing audit entry of the change's latest decision (BR7.4), so a new decision can never hide an earlier one. (1) One atomic conditional update moves the change from pending (or failed, for retry) to deciding and, in the same update, stores claimToken, claimedAt, claimedBy, claimedAction, claimReason and claimPreviousStatus; only the caller that wins goes on. (2) For approve and retry, call the guardrails server; a reject skips this step. (3) Write the final status, the decider, the reason, decidedAt, lastAction, lastOutcome and the increased decisionCount to the change, as one conditional update that only takes effect while the status is still deciding and the claimToken is the caller's own, and clear the claim fields. If it does not take effect (the claim was released meanwhile, BR7.3), the caller gets CLAIM_RELEASED (409) and appends nothing: the release wrote its own entry. (4) Append the audit entry with decisionNumber equal to decisionCount; appending the same (changeId, decisionNumber) twice has no effect. An implementation may do steps 3 and 4 in one database transaction; the recovery in BR7.4 still applies."
    violation: A different order, or two callers winning the claim, is a defect.
    source: FR3.4, FR3.5, FR3.6, FR3.7, components.md
  - id: BR3.5
    statement: A second decision on a decided change is refused and recorded.
    category: constraint
    applies_to: approve, reject
    trigger: Approve or reject on a change that is not pending
    logic: "IF the change is applied, rejected, failed or being decided by another caller THEN the claim is lost: refuse with ALREADY_DECIDED (409), leave the change unchanged and append an audit entry with outcome refused and the reason as submitted. The first decision stands."
    violation: A second decision taking effect is a defect.
    source: FR3.7
  - id: BR3.6
    statement: Approve applies the change through the server; reject writes nothing to the server.
    category: policy
    applies_to: approve, reject
    trigger: A decision that won the claim
    logic: "IF the action is approve THEN call apply_dependency_upgrade (upgrade) or rerun_ci_job (rerun) for the change's service and target; when it succeeds the status becomes applied and the audit outcome is applied. IF the action is reject THEN make no server call, the status becomes rejected and the audit outcome is rejected."
    violation: A server call on reject is a defect.
    source: FR3.4, FR3.5
  - id: BR3.7
    statement: A failed write marks the change failed.
    category: policy
    applies_to: approve, retry
    trigger: The server call does not succeed
    logic: "IF the server answers with a tool error or does not answer within the write timeout THEN the status becomes failed, failureMessage holds a fixed sentence that names the error code (or says the server did not answer), and the audit outcome is failed. The call is not repeated by the backend."
    violation: Leaving the change deciding or pending is a defect.
    source: FR3.6
  - id: BR3.8
    statement: A successful answer from the server means applied, including a no-op.
    category: policy
    applies_to: approve, retry
    trigger: The server answers successfully
    logic: IF apply_dependency_upgrade answers applied or already-current, or rerun_ci_job answers rerun-started, THEN the change is applied. A repeated write is safe because the server treats it as a no-op.
    violation: Treating already-current as a failure is a defect.
    source: FR3.4, u1 BR2.3, u1 BR2.4
  - id: BR3.9
    statement: Any unfamiliar server error counts as a failed write.
    category: policy
    applies_to: approve, retry
    trigger: The server returns an error code the backend does not know
    logic: "IF the error code is anything other than a known code (UNKNOWN_SERVICE, UNKNOWN_DEPENDENCY, UNKNOWN_RUN, INVALID_INPUT, FORCED_FAILURE, INTERNAL_ERROR) THEN treat it as a failed write with the generic failure message."
    violation: Crashing or leaving the change in deciding is a defect.
    source: FR3.6, u1 NFR design

  - id: BR4.1
    statement: Retry is only for a failed change.
    category: constraint
    applies_to: retry
    trigger: Retry on a change that is not failed
    logic: IF the change is pending, applied, rejected or being decided THEN refuse with NOT_FAILED (409), leave the change unchanged and append an audit entry with outcome refused and the reason as submitted.
    violation: Retrying a change that is not failed is a defect.
    source: FR3.6
  - id: BR4.2
    statement: A retry is a decision made the same way as an approval.
    category: policy
    applies_to: retry
    trigger: A retry that won the claim
    logic: "IF the retry succeeds THEN the change becomes applied, failureMessage is cleared and the audit outcome is applied. IF it fails again THEN the change stays failed with a new failureMessage and another audit entry with outcome failed is appended, so each failed attempt has its own entry."
    violation: Losing the second failed entry is a defect.
    source: FR3.6
  - id: BR4.3
    statement: Anyone except the proposer and the auditor may retry.
    category: authorization
    applies_to: retry
    trigger: Retry request
    logic: IF the actor is not the proposer and not an auditor THEN the retry may proceed through the order in BR3.4. The refusals for the proposer and the auditor are those of BR3.3 and BR3.2.
    violation: A proposer retry that takes effect is a defect.
    source: FR3.3, FR3.6

  - id: BR5.1
    statement: The audit log can only be appended to and read.
    category: constraint
    applies_to: AuditLog
    trigger: Any use of the audit component
    logic: "IF code or a caller wants to use the audit log THEN it offers append and read only: no edit, no delete. The audit table also has a database rule that blocks updates and deletes where the database supports it."
    violation: Any way to change or remove an entry is a defect.
    source: FR4.1, NFR5, Q5
  - id: BR5.2
    statement: Every proposal, decision and refusal appends exactly one entry with the full set of fields.
    category: policy
    applies_to: AuditLog
    trigger: A propose, an approve, a reject, a retry or a refused attempt that passed the empty-reason check
    logic: "IF such an action happens THEN one entry is appended with time, actor (the signed-in demo user), action, service, target, outcome (proposed, applied, rejected, failed or refused), the reason as submitted (absent for a proposal) and the change id when there is one. An empty reason writes no entry (BR3.1)."
    violation: A missing or doubled entry is a defect.
    source: FR4.2, FR5.2, P2
  - id: BR5.3
    statement: The reason is shown exactly as submitted.
    category: constraint
    applies_to: AuditLog, Change
    trigger: A decision or refusal with a reason
    logic: IF a reason is stored THEN it is stored and returned without trimming or other change.
    violation: A changed reason is a defect.
    source: FR3.2, FR4.2
  - id: BR5.4
    statement: Audit reads are scoped to a service, newest first, filterable and paged.
    category: policy
    applies_to: AuditLog
    trigger: An audit read
    logic: "IF entries are read for a service THEN they are returned newest first (time, then entryId, both descending), filtered by from and to (both inclusive), actor (a userId), action and outcome when given, and paged by page and pageSize (default 20, at most 100). A service with no entries returns an empty page, not an error."
    violation: Entries of another service, or a wrong order, are defects.
    source: FR4.3, P3
  - id: BR5.5
    statement: Audit reads do not depend on the guardrails server.
    category: constraint
    applies_to: AuditLog
    trigger: An audit read while the server is down
    logic: IF the server cannot be reached THEN audit reads and change reads still succeed.
    violation: An audit read that fails because of the server is a defect.
    source: FR11.2, Q2 of Contract Design
  - id: BR5.6
    statement: Entry ids and times order the log without ties.
    category: constraint
    applies_to: AuditEntry
    trigger: Entries with the same time
    logic: IF two entries have the same time THEN the one with the higher entryId counts as newer.
    violation: An unstable order is a defect.
    source: FR4.3

  - id: BR6.1
    statement: Plan and CI reads relay the server's data with the allowed actions, and fail when the server cannot be used.
    category: policy
    applies_to: plan and CI reads
    trigger: A read of the upgrade plan or the failed CI runs
    logic: "IF the server answers THEN return its items in the server's order, each with its allowed actions (BR6.2); an empty list is returned as an empty list. IF the server does not answer within the read timeout, or answers with any tool error, THEN return SERVER_UNREACHABLE (503). An unknown service is NOT_FOUND."
    violation: Returning stale or invented data is a defect.
    source: FR1.1, FR2.1, FR11.2
  - id: BR6.2
    statement: Allowed actions follow one order of reasons.
    category: authorization
    applies_to: all item lists
    trigger: Building an item
    logic: "For each action on each item the first reason that applies wins: SERVER_UNREACHABLE (the server is not reachable, BR7.1), AUDITOR_READ_ONLY, PROPOSER_CANNOT_DECIDE (for approve, reject and retry), IN_PROGRESS (the change is being decided), then the state reasons: NOT_PENDING (approve or reject on a non-pending change), NOT_FAILED (retry on a non-failed change) and ALREADY_CURRENT (propose on a dependency at its recommended version). An action with no reason is allowed. All four write actions are disabled while the server is unreachable, as FR11.2 states, even though a reject needs no server call."
    violation: A different order or a missing reason is a defect.
    source: FR3.3, FR11.2, P1
  - id: BR6.3
    statement: Every change item carries the allowed actions for approve, reject and retry.
    category: policy
    applies_to: changes reads
    trigger: A read of changes
    logic: IF changes are returned THEN each carries its allowedActions with a reason when not allowed, so the UI decides nothing.
    violation: An item without allowed actions is a defect.
    source: FR3.2, FR3.3
  - id: BR6.4
    statement: The changes list is for one service, newest first, open by default, at most 200.
    category: policy
    applies_to: changes reads
    trigger: A read of changes
    logic: "IF the status filter is open or not given THEN return pending and failed changes (and ones being decided, shown with their previous status); other values are pending, applied, rejected or failed. Return at most the newest 200 by proposedAt then changeId. Each item shows what it will do, who proposed it and its status."
    violation: Returning another service's changes is a defect.
    source: FR3.1, P4, Q6
  - id: BR6.5
    statement: The backend tells the UI who is signed in.
    category: policy
    applies_to: the me read
    trigger: A read of the signed-in user
    logic: IF a valid identity is present THEN return the user id, the name and the role, for display only.
    violation: Trusting this value for a decision is a defect; decisions use BR1.1.
    source: FR5.1

  - id: BR7.1
    statement: The server counts as reachable when its health route answers.
    category: constraint
    applies_to: ServerHealth
    trigger: A read that needs the allowed actions
    logic: "IF the health route answers within 1 second THEN the server is reachable; otherwise it is not. The result is reused for 5 seconds. A server that answers but is forced to fail counts as reachable."
    violation: Treating a forced failure as an outage is a defect (it would hide Retry).
    source: FR11.2, FR3.6, R-01 of Contract Design
  - id: BR7.2
    statement: Server calls time out and are never retried by the backend.
    category: constraint
    applies_to: calls to the guardrails server
    trigger: Any server call
    logic: IF the call is a read THEN it times out after 3 seconds; IF it is a write THEN after 10 seconds, which is below the 30 second claim release. The backend never repeats a call by itself.
    violation: An automatic retry is a defect.
    source: Contract C2, Q8 of Contract Design
  - id: BR7.3
    statement: A claim that does not finish within 30 seconds is released to failed.
    category: constraint
    applies_to: Change
    trigger: A read of changes, or a decision, finds a change in deciding for more than 30 seconds
    logic: "IF a change has been deciding for more than 30 seconds THEN one conditional update, that takes effect only for the caller that still sees status deciding with the same claimToken and a claimedAt older than 30 seconds, releases it, and in the same database transaction appends its audit entry, so two readers cannot both release it. For a claimed approve or retry: the status becomes failed with failureMessage Interrupted, decisionCount increases, decidedBy, decisionReason, lastAction and lastOutcome (failed) come from the claim fields, and the audit entry has action approve or retry, actor claimedBy, outcome failed, the claimReason and decisionNumber equal to the new decisionCount. For a claimed reject, nothing was applied, so the change goes back to claimPreviousStatus (pending), decisionCount does not change, and the audit entry has action reject, actor claimedBy, outcome failed, the claimReason and no decisionNumber. The claim fields are cleared."
    violation: A change stuck in deciding, or a double release, is a defect.
    source: components.md, R-05 of Contract Design
  - id: BR7.4
    statement: A proposal or decision that has no audit entry gets one before the change is read or decided again.
    category: constraint
    applies_to: Change, AuditEntry
    trigger: A read of changes, or step 0 of a decision, finds a change with no audit entry for its latest decision number (decisionCount) or, when decisionCount is 0, no proposal entry (decisionNumber 0)
    logic: "IF the change record shows a proposal or decision whose audit entry is missing THEN append the entry from the change record (for a decision: actor decidedBy, action lastAction, outcome lastOutcome, reason decisionReason, time decidedAt, decisionNumber decisionCount; for a proposal: actor proposedBy, action propose, outcome proposed, time proposedAt, decisionNumber 0). The append has no effect if the entry already exists, so a repair that runs while the original step 4 is in flight cannot duplicate it. Because a new decision first repairs the latest one (BR3.4 step 0), the change record's single latest decision is always enough: no earlier decision can be lost. IF appending fails THEN the read still returns its data, the failure is logged, and the repair is tried again at the next read or decision."
    violation: A permanently missing audit entry is a defect.
    source: components.md, R-05 of Contract Design
  - id: BR7.5
    statement: The internal deciding state is never shown.
    category: constraint
    applies_to: all reads
    trigger: A read while a change is being decided
    logic: IF a change is in deciding THEN it is returned with its claimPreviousStatus (pending, or failed for a retry) and all its decision actions disabled with the reason IN_PROGRESS.
    violation: Returning the status deciding is a defect.
    source: components.md
  - id: BR7.6
    statement: A write that timed out may still have happened, and a retry is safe.
    category: policy
    applies_to: approve, retry
    trigger: The server did not answer a write in time
    logic: IF the write timed out THEN the change is failed (BR3.7) and the message says the server did not answer; because the server treats a repeated apply or re-run as a no-op, a later retry does no harm.
    violation: Marking the change applied without an answer is a defect.
    source: FR3.6, u1 BR2.3, u1 BR2.4, R-03 of Contract Design

  - id: BR7.7
    statement: Writes are refused while the health probe says the server is unreachable.
    category: constraint
    applies_to: propose, approve, reject, retry
    trigger: A write request that passed the identity, existence, reason and role checks while the server is not reachable (BR7.1)
    logic: "IF the server is not reachable THEN refuse with SERVER_UNREACHABLE (503) before any claim and write nothing: no change update and no audit entry. This keeps a direct call consistent with the allowed actions (BR6.2), including a reject, which needs no server call but is disabled during an outage by FR11.2. IF the probe says reachable but the server call then fails or times out, the change becomes failed (BR3.7) as usual."
    violation: A claim or a write made while the probe says unreachable is a defect.
    source: FR11.2, FR3.6

  - id: BR8.1
    statement: Changes and audit entries are stored durably and the claim is atomic.
    category: constraint
    applies_to: Change, AuditEntry
    trigger: Any write
    logic: "IF a change or an entry is written THEN it is stored in the database chosen for the sample (PostgreSQL), and survives a restart of the backend. The claim in BR3.4 is one atomic conditional update that succeeds for exactly one caller."
    violation: Losing a change or an entry on restart, or two winners of one claim, are defects.
    source: FR4.1, NFR5, Q1
```

## Summary

| Group | Rules | In short |
|---|---|---|
| Identity | BR1.1–BR1.4 | Actor and role come only from the sign-in; three fixed demo users; no identity means refused; the auditor is read only |
| Proposing | BR2.1–BR2.6 | A proposal makes a pending change and a proposed entry; duplicates allowed; only worthwhile targets; the server must answer; the summary is fixed at proposal |
| Deciding | BR3.1–BR3.9 | Reason required; auditor and proposer refused and recorded; fixed order claim, server, record, audit; second decision refused; failures mark the change failed |
| Retry | BR4.1–BR4.3 | Only a failed change; a retry is a decision with its own audit entry each time; not the proposer or the auditor |
| Audit | BR5.1–BR5.6 | Append and read only; one entry per action and refusal; reasons unchanged; service-scoped, newest first, filtered, paged; independent of the server |
| Reads | BR6.1–BR6.5 | Plan and CI relay with allowed actions and a 503 on outage; fixed reason order; open changes by default |
| Server and recovery | BR7.1–BR7.7 | Health-probe reachability; timeouts and no retries; release after 30 seconds as one conditional update with its entry; missing audit entries rebuilt before the next decision, without duplicates; deciding hidden; safe retries; writes refused during an outage |
| Storage | BR8.1 | Durable store and an atomic claim |
