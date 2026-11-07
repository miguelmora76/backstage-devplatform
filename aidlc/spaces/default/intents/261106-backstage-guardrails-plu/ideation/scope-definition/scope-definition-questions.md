# Scope Definition — Questions

## Q1. [Product] Which user-facing capabilities are must-have? (select all that apply)

Why we ask: these come from your description and decide the minimum the plugin must show; anything not selected becomes nice-to-have.

- A. A dependency-upgrade planning view on the catalog page
- B. A CI failure triage view on the catalog page
- C. The approval-gated write flow, usable from the UI
- D. A visible audit log of those writes
- X. Other (please specify)

[Answer]: A, B, C, D

## Q2. [Product] Which supporting capabilities are must-have? (select all that apply)

Why we ask: these make the sample runnable and verifiable; anything not selected becomes nice-to-have.

- A. The synthetic guardrails MCP server in its own container
- B. The seeded synthetic data generator
- C. One-command run with docker compose
- D. GitHub Actions CI
- X. Other (please specify)

[Answer]: A, B, C, D

## Q3. [Product] How important is the optional minikube run?

Why we ask: the feasibility work flagged it as the first thing to cut if time runs short.

- A. Should have: build it once the must-haves are done
- B. Could have: only if time clearly allows
- C. Won't have in this first version
- X. Other (please specify)

[Answer]: A

## Q4. [Product] What is the smallest slice that would already deliver value?

Why we ask: it defines the minimum viable scope and what the first demo shows.

- A. One tool end to end: upgrade planning, with its approval-gated write and the audit entry
- B. Both tools read-only on the catalog page, with writes and audit log added after
- C. Everything in the must-haves together, with no smaller slice
- D. Not yet defined
- X. Other (please specify)

[Answer]: C

## Q5. [Product] In what order should the work be sequenced?

Why we ask: it orders the backlog.

- A. Risk-first: the synthetic MCP server and approval flow before the UI
- B. Value-first: the UI the user sees before the supporting pieces
- C. Dependency-first: whatever the other pieces need goes first
- D. Not yet defined
- X. Other (please specify)

[Answer]: D

## Q6. [Product] Is any deadline tied to a specific capability?

Why we ask: the one-week target from feasibility is soft, so this checks whether any part is firmer.

- A. No, the date is soft for all capabilities
- B. Yes: the smallest valuable slice (Q4) should be demonstrable by the one-week target
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Must-have user-facing capabilities: upgrade planning view, CI triage view, approval-gated writes, audit log view (Q1: A, B, C, D)
- Must-have supporting capabilities: synthetic MCP server, seeded data generator, docker compose run, GitHub Actions CI (Q2: A, B, C, D)
- Minikube run: should have, after the must-haves (Q3: A)
- Smallest valuable slice: none smaller than the full must-have set (Q4: C)
- Sequencing: not yet defined; left for delivery planning (Q5: D)
- Deadlines: none tied to a capability; the date is soft for all (Q6: A)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
