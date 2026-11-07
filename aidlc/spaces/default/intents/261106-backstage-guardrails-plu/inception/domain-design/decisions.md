# Architecture Decisions

Sources: `requirements.md`, `stories.md`, `team-practices.md`, and answers Q1–Q5 in `domain-design-questions.md`. The component catalogue is in `components.md`.

## ADR-001: Split the plugin backend into ChangeWorkflow and AuditLog

- **Context:** The backend holds the change lifecycle and an append-only audit log (FR3, FR4.1, NFR5). A single component would let the code that changes state also change history.
- **Decision:** Two components. ChangeWorkflow owns changes and rules. AuditLog owns entries and exposes only "append an entry" and "read entries" (Q1: B).
- **Consequences:** Positive: append-only holds by construction, so no part of ChangeWorkflow can edit or delete an entry; the audit interface is small and easy to test. Negative: one extra boundary and one extra call per action; the audit store and the change store are separate, so one decision touches three places in a row.
- **Ordering and failure rule (decided here to keep FR3.4, FR3.7 and NFR5 true):** (1) ChangeWorkflow takes one atomic claim of the decision (pending or failed to an internal "deciding" state); only the winner continues, the loser is refused and audited. (2) For approve and retry it calls the guardrails server. (3) It writes the final status and decision details to the change record. (4) It appends the audit entry. If step 2 fails the change becomes failed and is audited as failed. If step 3 or 4 fails the user sees an error, and the change record is the recovery source: a decided change with no audit entry gets the entry appended on the next read. A claim not completed in 30 seconds is released to failed ("Interrupted"). Applying an already-applied upgrade is a successful no-op, so repeating step 2 is harmless.
- **Security:** the AuditLog interface (append and read only) is a security control for FR4.1: no component can rewrite history through it. It is not tamper-proof against someone with direct access to the audit store; that is acceptable for a local sample and must be revisited before any hosted use.
- **Alternatives Rejected:** One backend component owning both (Q1: A): simpler, but append-only would depend on discipline rather than on the interface.

## ADR-002: The plugin backend owns changes and the audit log; the guardrails server stays stateless about approvals

- **Context:** The original request spoke of an "existing approval-gated write flow". The approved requirements put the decision rules in the plugin backend (FR3.3, FR3.7, proposed FR12.1) and give the server four operations (FR6.1). A first answer put changes and the audit log in the server (Q2: B); it conflicted with ADR-001 and with the requirements, and was reversed (Q5: A).
- **Decision:** ChangeWorkflow owns Change and AuditLog owns AuditEntry, both in the plugin backend. The guardrails server lists data and applies approved writes only.
- **Consequences:** Positive: matches the approved requirements with no change to them; the rules the sample demonstrates are enforced in one place, in code we write. Negative: the sample does not model the approval flow as something that "already exists" in the guardrails server, so the stand-in is less faithful to that part of the original request.
- **Security:** keeping the decision rules in the plugin backend means one place enforces who may act (FR3.3, proposed FR12.1); the guardrails server trusts the backend and has no approval logic to bypass. The server must not be reachable by users directly in any hosted setup; for the local sample it is reachable only on the compose network.
- **Alternatives Rejected:** The guardrails server owns the approval flow and the audit log, with the backend relaying and enforcing who may act (Q2: B, Q5: B). Rejected because it would widen FR6.1 and FR3, move the audit log out of the plugin, and conflict with ADR-001.

## ADR-003: Demo users and roles live in a separate DemoIdentity component

- **Context:** The backend must read the acting user and role from a trusted identity, never from the request (Q11 of refined mockups, P5). Auditor is a role (proposed FR12.1).
- **Decision:** A separate DemoIdentity component owns DemoUser, issues the sign-in identity and supports switching users (Q3: A).
- **Consequences:** Positive: the backend has one trusted source for actor and role; swapping the sample sign-in for a real provider later touches one component (matches the future-hosting constraint). Negative: one more component to build and test for a sample.
- **Security:** DemoIdentity is a demo sign-in, not a real security boundary: switching users is a user's own choice and there is no authentication. The backend's rule that actor and role come from the identity is sound only because a real provider can replace DemoIdentity; one must replace it before any hosted use.
- **Alternatives Rejected:** Demo users inside the plugin backend (Q3: B): fewer parts, but identity would then be mixed with the rules that depend on it, and a real provider would be harder to substitute.

## ADR-004: A separate SeedDataGenerator produces the data the guardrails server loads

- **Context:** The data must be repeatable (FR7.2) and the plugin must never read seeded data directly (FR6.2).
- **Decision:** SeedDataGenerator writes a seed data set from a seed value; the guardrails server loads it at start (Q4: A).
- **Consequences:** Positive: repeatability is testable in isolation (same seed, same bytes); the server stays small; the data set can be swapped without touching the server. Negative: an extra step before the server starts, and a shared data-shape contract both sides must agree on. The contract is owned by SeedDataGenerator (the data set carries the services, dependencies and CI runs) and its exact shape is fixed in Functional Design. Applied upgrades are held in the server's memory and are lost on restart, when the data is reloaded from the seed.
- **Security:** the seed data is synthetic, so it holds no sensitive data; nothing in the generator or the data set needs protection.
- **Alternatives Rejected:** The server generates its own data at start from a seed value (Q4: B): fewer parts, but repeatability would then be tested through a running server, and the generator could not be reused on its own.

## ADR-005: Dependencies point one way, with no cycles; the UI never calls the guardrails server

- **Context:** Boundaries are the architecture; FR6.2 says the plugin reaches the guardrails tools only through the server's tool interface, and the UI holds no rules.
- **Decision:** GuardrailsPluginUI calls ChangeWorkflow, AuditLog and DemoIdentity only. ChangeWorkflow alone calls GuardrailsServer. The graph is acyclic (see the diagram in `components.md`). All calls are synchronous except the server's start-time load of the seed data set.
- **Consequences:** Positive: every rule has a single enforcement point; a server outage is visible in one place (FR11.2). Negative: the UI depends on the backend for reads of the plan and CI data, so a backend outage hides them.
- **Allowed actions:** ChangeWorkflow returns, for every change and every plan or CI row, the actions allowed to the signed-in user and the reason when one is not, so the UI never re-derives a rule; it takes the user's role from DemoIdentity for display only.
- **Audit reads:** AuditLog depends on nothing, so reading the audit log keeps working while the guardrails server is down; only the views that need the server show the unreachable error (FR11.2).
- **Forced failure for testing:** the guardrails server has a start-up failure setting outside its four operations; the plugin never calls it.
- **Security:** one enforcement point (ChangeWorkflow) and a UI that only displays what it is told reduce the chance of a rule being enforced in one place and bypassed in another.
- **Alternatives Rejected:** The UI reading plan and CI data straight from the guardrails server: fewer hops, but it would let the UI bypass the backend and spread the unreachable-server handling across two layers.
