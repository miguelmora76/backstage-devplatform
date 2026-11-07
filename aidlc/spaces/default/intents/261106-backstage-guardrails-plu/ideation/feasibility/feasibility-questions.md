# Feasibility & Constraints — Questions

## Q1. [Developer] Which Backstage backend and language should the plugin target?

Why we ask: it fixes the main technical constraint and the skill profile the build assumes.

- A. TypeScript on Backstage's current "new" backend and frontend systems
- B. TypeScript on the legacy Backstage backend/frontend
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q2. [Developer] How should the stubbed guardrails tools be provided to the plugin?

Why we ask: the earlier answer was to create a synthetic guardrails server and approval flow here; this decides its shape and the integration boundary.

- A. As a separate MCP server process (its own container) that the Backstage backend calls
- B. As an in-process module inside the Backstage backend plugin that mimics the tools
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q3. [Developer] Where does the synthetic dependency and CI data come from?

Why we ask: the tools need inputs (dependency versions, CI runs); this decides how realistic and repeatable the demo is.

- A. Static fixture files checked into the repo
- B. A seeded generator script that produces the same synthetic data every run
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q4. [Operations] Which local runtime must the one-command run support?

Why we ask: the description allows docker compose or minikube; supporting both costs more.

- A. docker compose only
- B. minikube only
- C. docker compose as the primary path, minikube optional
- D. Not yet defined
- X. Other (please specify)

[Answer]: C

## Q5. [Compliance] Are there regulatory or data-handling requirements?

Why we ask: it decides whether the audit log needs more than a visible, append-only record.

- A. None: all data is synthetic, so no regulatory requirements apply
- B. None apply, but the audit log should still be append-only and show who approved what
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q6. [Product] What budget, timeline or organizational blockers apply?

Why we ask: it bounds how much we can build and whether any date drives scope.

- A. Spare-time project: no deadline, no budget, no blockers
- B. A target date exists (state it under Other)
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q7. [Operations] Are any AWS accounts or services involved?

Why we ask: the description says local only; this confirms nothing cloud-side is needed.

- A. None: everything runs locally
- B. Not for this version, but keep the design free of local-only assumptions where cheap
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q8. [Product] When is the target date you mentioned in Q6?

Why we ask: you said a target date exists but not what it is; it bounds how much fits.

- A. Within about a week
- B. Within about a month
- C. Within about a quarter
- X. Other (please specify)

[Answer]: A

## Q9. [Product] How should the one-week target (Q8) be reconciled with the chosen scope?

Why we ask: a separate MCP server container, seeded generator, compose plus optional minikube, CI and a coverage floor are a lot for one week.

- A. Keep the full scope and treat the week as a soft target
- B. Cut minikube; docker compose only, everything else stays
- C. Cut to the smallest slice: in-process stub, fixtures, compose only; keep CI and coverage
- D. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Stack: TypeScript on Backstage's new backend and frontend systems (Q1: A)
- Stubbed guardrails tools: a separate MCP server in its own container (Q2: A)
- Synthetic data: a seeded generator, same data every run (Q3: B)
- Runtime: docker compose primary, minikube optional (Q4: C)
- Regulatory: none, but the audit log is append-only and shows who approved what (Q5: B)
- Timeline: a one-week target that is soft; full scope is kept (Q6: B, Q8: A, Q9: A)
- AWS: none now, stay portable where cheap (Q7: B)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
