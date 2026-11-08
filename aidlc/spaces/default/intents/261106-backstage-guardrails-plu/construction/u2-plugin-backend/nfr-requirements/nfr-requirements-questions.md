# NFR Requirements — u2-plugin-backend — Questions

This unit is the plugin backend: the service that proposes, decides and records changes, keeps the audit log, and relays the plan and failed CI runs from the guardrails server. Already fixed by earlier stages, so not asked again: TypeScript on Backstage's backend system; PostgreSQL as the durable store with an atomic claim (BR8.1); reads time out after 3 seconds and writes after 10, with no automatic retries (BR7.2); a claim is released after 30 seconds (BR7.3); lists hold at most 200 changes and audit pages at most 100 entries; the actor and role come only from the sign-in (BR1.1); the audit log is append-only (BR5.1); at least 85% line coverage with tests written first (NFR2); Prettier and ESLint (NFR6); no address hard-coded outside settings.

Settled as targets without asking (written into the requirements for you to correct): reads of changes and the audit log answer in at most 300 milliseconds at the 95th percentile, and a decision answers in at most 1 second plus the server's own time, both measured on the backend with the seeded data and a local database; the plan and failed-run reads add at most 200 milliseconds to the server's answer (so each view stays far inside the 5-second target of NFR1); at least 10 requests at the same time without error, and when 10 callers decide the same change at once exactly one wins; the backend uses no more than 512 MB of memory beyond Backstage's own; the audit table is indexed for the service-and-time read and stays fast at 100,000 entries; database changes are made by versioned migrations that run at start-up; the backend writes one log line per request (time, route, actor id, status, error code, duration) and never writes a reason text or a setting value to the log; an unexpected failure returns a plain 500 with no internal detail and writes nothing partial.

## Q1. [Quality] How should the tests reach a database?

Why we ask: the atomic claim, the 30-second release and the "no duplicate audit entry" rules only mean something against a real database engine, but a real database in tests needs a container (docker) on every developer machine and in CI. Recommendation: A, because those rules are the core risk of this unit and CI on GitHub Actions can run PostgreSQL as a service.

- A. Run the rule tests (claim, release, repair, append-only) against a real PostgreSQL started for the test run; all other tests use an in-memory stand-in for the store
- B. Use an in-memory stand-in for the store in every test, and check the real database only by hand in the compose run
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q2. [Security] Is the passwordless demo sign-in acceptable as it is?

Why we ask: by design the demo sign-in lets anyone who can open the page become any of the three users, including the platform engineer, without a password (contract C3). That is the point of the demo, and the backend still checks every role and the no-self-approval rule. If the sample were ever hosted, anyone who could reach it could act as any user. Recommendation: A, because the sample is local only and the team wants to avoid choices that block hosting later, not to build for it now.

- A. Accept it for the local sample. The demo sign-in is switched on by a setting that the compose run turns on and that is off by default, so a hosted run cannot get it by accident. The hosting-later risk is recorded in the requirements
- B. Always on, with no switch, and record the risk
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- The rule tests (claim, release, repair, append-only) run against a real PostgreSQL started for the test run, in CI as a service; other tests use an in-memory stand-in for the store (Q1: A)
- The demo sign-in is accepted for the local sample; it is enabled by a setting that compose turns on and that is off by default, and the hosting-later risk is recorded in the requirements (Q2: A)
- Targets set without asking: reads of changes and audit at most 300 ms at the 95th percentile; a decision at most 1 second plus the server's time; plan and failed-run reads add at most 200 ms; at least 10 simultaneous requests without error and exactly one winner among 10 callers deciding the same change; at most 512 MB beyond Backstage's own; audit read fast at 100,000 entries; versioned migrations at start-up; one log line per request with no reasons or setting values; unexpected failures return a plain 500 and write nothing partial

- Looks correct
- Request changes

[Answer]: Looks correct
