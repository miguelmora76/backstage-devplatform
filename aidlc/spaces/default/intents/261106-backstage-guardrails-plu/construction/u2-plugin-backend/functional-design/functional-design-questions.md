# Functional Design — u2-plugin-backend — Questions

This unit is the Backstage backend plugin: the change workflow (propose, approve, reject, retry), the append-only audit log, and the demo sign-in's users and roles. It carries the stories US5.1, US2.1, US2.2, US3.1, US3.2, US3.3, US4.1 and the backend side of US1.1, US1.2 and US5.2. The backend interface is fixed in Contract Design (contract C1), the server's tool interface in C2, and the decision order in `components.md`.

Q1 is a bigger choice and was put to you. Q2–Q7 are small details; on your standing instruction to settle those yourself they were answered with the recommended option and are listed for you to correct at the summary confirmation.

Settled without asking, from earlier stages: the backend reads actor and role from the sign-in identity, never from a request; the auditor cannot write (FR12.1, proposed); the proposer cannot approve, reject or retry their own change; a reason is required for approve, reject and retry and an empty reason writes nothing; a second decision on a decided change is refused and audited; a proposal is itself an audit entry with outcome `proposed`; duplicate proposals are allowed; open changes are pending plus failed; the claim, server call, change record, audit entry order; an unfinished claim is released to failed with "Interrupted" after 30 seconds; a decided change with no audit entry gets one appended when changes are next read; plan and CI reads fail with 503 when the server is unreachable while changes and audit reads keep working; reads time out at 3 seconds and writes at 10 seconds with no automatic retry.

## Q1. [Architecture] Where are changes and audit entries stored, and do they survive a restart?

Why we ask: the audit log is meant to be durable, and the reviewer of the contract noted that nothing yet says which database the compose and minikube runs use. Backstage backends keep plugin data through a database setting, so the choice is a setting, not a rewrite. Recommendation: A.

- A. A SQLite database file on a docker volume: simple, survives restarts of the app container, no extra container. Switching to PostgreSQL later is a configuration change
- B. A PostgreSQL container in the compose run: the usual Backstage choice and closer to a hosted setup, but one more container to start, wait for and document
- C. In memory only: nothing survives a restart, so the audit log would be lost each time the sample is stopped
- D. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q2. [Product] Who may propose a change?

- A. The service owner and the platform engineer; the auditor may not (read only)
- X. Other (please specify)

[Answer]: A

## Q3. [Architecture] How does the backend know the guardrails server is unreachable when it builds the allowed actions on the changes and audit reads (which do not otherwise call the server)?

- A. It probes the server's health route with a 1 second timeout and keeps the result for 5 seconds. A server that answers, even with the forced-failure setting on, counts as reachable; no answer within the timeout counts as unreachable. A forced failure therefore still lets a non-proposer retry a failed change (FR3.6), and reject is never disabled by an outage because it never calls the server
- X. Other (please specify)

[Answer]: A

## Q4. [Product] May a change be proposed for an item that does not need it?

- A. No. A dependency already at the recommended version is not proposable (allowed action reason ALREADY_CURRENT, additive to contract C1), and a re-run is proposable only for a run that is currently failed. A proposal for an unknown service, dependency or run is refused as not found
- X. Other (please specify)

[Answer]: A

## Q5. [Security] How is the audit log kept append-only?

- A. The audit component offers only append and read, and the table gets a database rule that blocks updates and deletes where the database supports it, so the guarantee does not depend on code alone
- X. Other (please specify)

[Answer]: A

## Q6. [Operations] How many changes does a list return?

- A. The changes list returns the newest 200 for a service, newest first; the audit list is paged at 20 per page up to 100 (contract C1). Both caps are stated in the interface
- X. Other (please specify)

[Answer]: A

## Q7. [Product] When is the "what it will do" text of a change written?

- A. When the change is proposed, from the server's data at that moment (for example "Upgrade checkout-api/left-pad-ng from 1.2.0 to 1.4.1"), and kept unchanged; the approve call applies whatever the target is at the time
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Changes and audit entries are stored in a PostgreSQL container in the compose run (Q1: B); this adds a database service for u5-compose-and-ci and database settings for u4-backstage-app
- The service owner and the platform engineer may propose; the auditor may not (Q2: A)
- The backend probes the server health route (1 second timeout, result kept 5 seconds) to know whether it is reachable; a server that answers, even forced to fail, counts as reachable (Q3: A)
- A dependency already at the recommended version is not proposable (reason ALREADY_CURRENT, additive to contract C1) and a re-run is proposable only for a currently failed run; unknown targets are refused as not found (Q4: A)
- The audit log offers only append and read, plus a database rule blocking updates and deletes where supported (Q5: A)
- The changes list returns the newest 200 for a service; the audit list is paged at 20 up to 100 (Q6: A)
- The "what it will do" text is written when the change is proposed and kept unchanged (Q7: A)

- Looks correct
- Request changes

[Answer]: Looks correct
