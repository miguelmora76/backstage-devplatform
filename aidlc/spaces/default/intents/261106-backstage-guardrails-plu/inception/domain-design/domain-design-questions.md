# Domain Design — Questions

A component here is code you write. Databases, containers and Backstage itself are dependencies of components, not components.

## Q1. [Architecture] Should the plugin backend be one building block or two?

Why we ask: the backend holds the change workflow (propose, approve, reject, retry, refusal rules) and the append-only audit log.

- A. One backend component that owns both the change workflow and the audit log
- B. Two components: a change workflow component and an audit log component whose only interface is "append an entry" and "read entries"
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q2. [Architecture] Who owns pending changes and the audit log: the plugin backend or the synthetic guardrails server?

Why we ask: your original request spoke of the "existing" approval-gated write flow, while the requirements say the plugin backend enforces the decision rules and the guardrails server only lists data and applies writes.

- A. The plugin backend owns changes and the audit log; the guardrails server only lists data and applies approved writes
- B. The guardrails server owns the approval flow and the audit log; the plugin backend only passes requests through and enforces who may act
- C. Not yet defined
- X. Other (please specify)

[Answer]: B (answered first; it conflicted with Q1 and the approved requirements, and was reversed by Q5)

## Q3. [Architecture] Where do the demo users and their roles live?

Why we ask: the backend must read the acting user and role from a trusted identity.

- A. A separate small component: the demo sign-in provider, which owns the demo users and their roles
- B. Part of the plugin backend
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q4. [Architecture] How does the seeded data generator relate to the guardrails server?

Why we ask: the generator must be repeatable, and the plugin must never read seeded data directly.

- A. A separate generator component writes a seed data set; the guardrails server loads it at start
- B. The guardrails server generates its own data at start from a seed value
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q5. [Architecture] Q1 split the plugin backend into two components, while Q2 put the change workflow and audit log in the guardrails server. The approved requirements have the plugin backend enforce the decision rules and the server offer four operations only. How should this be resolved?

Why we ask: the two answers describe different designs, and the second would change the approved requirements.

- A. The plugin backend owns changes and the audit log, split into two components as in Q1: it matches the approved requirements and needs no requirement changes
- B. The guardrails server owns changes and the audit log, split into two components there; the backend only enforces who may act and relays: this widens FR6.1 and FR3
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- The plugin backend is two building blocks: a change workflow component and an audit log component with only "append an entry" and "read entries" (Q1: B)
- The plugin backend owns pending changes and the audit log; the guardrails server only lists data and applies approved writes. An earlier answer that gave these to the server was reversed, to match the approved requirements (Q2, Q5: A)
- The demo users and their roles are owned by a separate demo sign-in component (Q3: A)
- A separate seed data generator writes the data set that the guardrails server loads at start (Q4: A)
- The resulting building blocks are six: the plugin screens, the change workflow, the audit log, the demo sign-in, the guardrails server and the seed data generator

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
