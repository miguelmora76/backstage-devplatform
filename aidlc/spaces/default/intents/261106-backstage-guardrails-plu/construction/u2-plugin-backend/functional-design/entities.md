# Entities — u2-plugin-backend

Sources: `components.md` (ChangeWorkflow, AuditLog and DemoIdentity entities and the decision order), `unit-of-work.md` (u2 owns Change, AuditEntry and DemoUser), `contract-summary.md` (contracts C1 and C2), the refined mockups' changes P1–P5 as carried in the contract summary, and answers Q1–Q7 in `functional-design-questions.md`. The YAML block is the source of truth; the text after it is a summary.

```yaml
entities:
  - name: DemoUser
    owner: DemoIdentity
    description: One of the synthetic people who can sign in. The only source of actor and role for the backend.
    attributes:
      - { name: userId, type: string, required: true, unique: true, allowed: [sam, priya, alex], constraints: "Lowercase first name; the part after user:default/ in the sign-in identity" }
      - { name: name, type: string, required: true }
      - { name: role, type: string, required: true, allowed: [service-owner, platform-engineer, auditor], constraints: "Fixed per user: sam service-owner, priya platform-engineer, alex auditor" }
    relationships: []

  - name: Change
    owner: ChangeWorkflow
    description: A proposed write (an upgrade or a CI re-run) and its life through the approval flow.
    attributes:
      - { name: changeId, type: string, required: true, unique: true, constraints: "Opaque; assigned at proposal; increases over time so ties can be ordered" }
      - { name: kind, type: string, required: true, allowed: [upgrade, rerun] }
      - { name: service, type: string, required: true, constraints: "serviceName from the guardrails server" }
      - { name: target, type: string, required: true, constraints: "dependencyKey for upgrade, runKey for rerun; opaque" }
      - { name: summary, type: string, required: true, constraints: "What the change will do in words, written once at proposal from the server's data and never changed" }
      - { name: proposedBy, type: string, required: true, references: DemoUser }
      - { name: status, type: string, required: true, allowed: [pending, deciding, applied, rejected, failed], default: pending, constraints: "deciding is internal: it is never returned to callers (see BR7.5)" }
      - { name: decidedBy, type: string, required: false, references: DemoUser, constraints: "The user who made the latest decision" }
      - { name: decisionReason, type: string, required: false, constraints: "The reason of the latest decision, exactly as submitted" }
      - { name: failureMessage, type: string, required: false, constraints: "Fixed text; set when status is failed, cleared when a retry succeeds" }
      - { name: proposedAt, type: timestamp, required: true }
      - { name: decidedAt, type: timestamp, required: false, constraints: "Time of the latest decision" }
      - { name: claimedAt, type: timestamp, required: false, constraints: "Set while status is deciding; used for the 30 second release" }
      - { name: claimToken, type: string, required: false, constraints: "Set with the claim, unique per claim; the finish and the release only take effect when they present this token while the status is still deciding" }
      - { name: claimedBy, type: string, required: false, references: DemoUser, constraints: "The actor who made the claim; used to write the audit entry if the claim is released" }
      - { name: claimedAction, type: string, required: false, allowed: [approve, reject, retry], constraints: "The action that was claimed" }
      - { name: claimReason, type: string, required: false, constraints: "The reason submitted with the claimed action, exactly as given" }
      - { name: claimPreviousStatus, type: string, required: false, allowed: [pending, failed], constraints: "The status before the claim: what reads show while deciding (BR7.5) and what a released reject goes back to" }
      - { name: decisionCount, type: integer, required: true, default: 0, constraints: "Increases by one each time a decision is recorded (approve, reject, retry, or a released claim); used to find decisions without an audit entry" }
      - { name: lastAction, type: string, required: false, allowed: [approve, reject, retry], constraints: "Action of the latest decision; with lastOutcome it lets a missing audit entry be rebuilt" }
      - { name: lastOutcome, type: string, required: false, allowed: [applied, rejected, failed] }
    constraints:
      - "A change in status pending has decisionCount 0 or, after a released claim, never returns to pending"
      - "A change in status applied or rejected is final; failed can be retried"
      - "The claim fields are set together with status deciding and cleared when the status leaves deciding"
    relationships:
      - { to: DemoUser, cardinality: "many to one", direction: "proposed by" }
      - { to: DemoUser, cardinality: "many to one (optional)", direction: "decided by" }
      - { to: AuditEntry, cardinality: "one to many", direction: "is recorded by" }

  - name: AuditEntry
    owner: AuditLog
    description: One line of the append-only record of an action or refusal.
    attributes:
      - { name: entryId, type: string, required: true, unique: true, constraints: "Opaque; increases over time; the tie-breaker for entries with equal time" }
      - { name: time, type: timestamp, required: true }
      - { name: actor, type: string, required: true, references: DemoUser }
      - { name: action, type: string, required: true, allowed: [propose, approve, reject, retry] }
      - { name: service, type: string, required: true }
      - { name: target, type: string, required: true, constraints: "The change's target, or the requested target for a refused proposal" }
      - { name: outcome, type: string, required: true, allowed: [proposed, applied, rejected, failed, refused] }
      - { name: reason, type: string, required: false, constraints: "The submitted reason exactly as given; absent for a proposal" }
      - { name: changeId, type: string, required: false, references: Change, constraints: "Absent for a refused proposal that created no change" }
      - { name: decisionNumber, type: integer, required: false, constraints: "0 on the entry written for a proposal; the change's decisionCount at the time on a decision entry (outcome applied, rejected or failed); absent on refused entries. Together with changeId it is unique, so appending the same entry twice has no effect, and it is what recovery looks for" }
    constraints:
      - "Entries are never changed or removed after they are written (BR5.1)"
      - "The pair (changeId, decisionNumber) is unique where decisionNumber is present"
    relationships:
      - { to: DemoUser, cardinality: "many to one", direction: "acted by" }
      - { to: Change, cardinality: "many to one (optional)", direction: "concerns" }

value_objects:
  - name: ServerHealth
    description: The backend's short-lived view of whether the guardrails server answers. Not stored.
    attributes:
      - { name: reachable, type: boolean, required: true }
      - { name: checkedAt, type: timestamp, required: true, constraints: "A result is reused for 5 seconds" }
  - name: Decision
    description: One request to approve, reject or retry a change, as the rules see it. Not stored.
    attributes:
      - { name: action, type: string, required: true, allowed: [approve, reject, retry] }
      - { name: changeId, type: string, required: true }
      - { name: reason, type: string, required: true }
      - { name: actor, type: string, required: true, constraints: "Taken from the sign-in identity, never from the request" }
```

## Summary

Three stored entities: `DemoUser` (three fixed users and roles), `Change` (a proposed write and its status) and `AuditEntry` (the append-only line for every proposal, decision and refusal). Two small objects are not stored: `ServerHealth` and `Decision`.

The change record is the recovery source. `decisionCount`, `lastAction` and `lastOutcome` let the backend find a decision whose audit entry is missing, and rebuild that entry from the change itself.

Every key (changeId, entryId, serviceName, dependencyKey, runKey) is an opaque string to callers. Only `Change` and `AuditEntry` are persisted, in the database chosen in Q1 (PostgreSQL); the guardrails server's entities (service, dependency, CI run) belong to u1 and are only referred to by key.
