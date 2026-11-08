# Infrastructure Design — u2-plugin-backend — Questions

The plugin backend is a package that runs inside the Backstage backend on a developer laptop, started by docker compose (team practices: local only, hosting later possible). The five choices below are small details; on your instruction to settle those yourself (message 633d038b) they were answered with the recommended option and are listed for you to correct at the summary confirmation. This unit owns no compose file and no image of its own; u4 and u5 own those.

## Q1. [Operations] How is the plugin deployed?

- A. As a package of the same workspace, built into the Backstage backend image that u4 and u5 own; no container of its own
- B. As a separate container with its own image
- X. Other (please specify)

[Answer]: A

## Q2. [Operations] Where does the database come from?

- A. A PostgreSQL service in the compose file (written in u5-compose-and-ci) with a named volume so changes and audit entries survive a restart; the plugin reads the login from Backstage's database settings, supplied as environment variables. A second, throw-away PostgreSQL service for local test runs is defined in a compose file kept with this unit's tests, and CI uses a PostgreSQL service container
- B. An embedded file database
- X. Other (please specify)

[Answer]: A

## Q3. [Security] How are secrets and settings handled?

- A. The only secret is the sample database password: it is an environment variable with a sample value in the compose file, never in code or app-config files; the server address and timeouts are app-config keys with the values supplied by compose; the demo sign-in is off in the shipped app-config and switched on only in the compose override (a dependency for u4 and u5)
- B. A settings file mounted into the container
- X. Other (please specify)

[Answer]: A

## Q4. [Delivery] What does the pipeline do for this unit?

- A. On every pull request: format check, lint, type check, tests with the 85% coverage floor (rule tests on a PostgreSQL service container), the contract check of the stand-in server against the C2 spec, and a check that the plugin builds into the backend package. No deployment step and no rollback procedure beyond reverting the pull request, because nothing deploys automatically
- B. The same, plus publishing the package to a registry
- X. Other (please specify)

[Answer]: A

## Q5. [Operations] What monitoring is built?

- A. The log line per request and the Backstage readiness route only; no metrics, alerts or dashboards. The compose health check of the app uses the readiness route
- B. Add a metrics endpoint and a dashboard
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- The plugin ships as a package inside the Backstage backend image owned by u4 and u5, with no container of its own (Q1: A)
- PostgreSQL is a compose service with a named volume (u5); local test runs use a throw-away PostgreSQL compose service kept with this unit's tests; CI uses a PostgreSQL service container (Q2: A)
- The only secret is the sample database password, an environment variable supplied by compose; the demo sign-in is off in the shipped app-config and on only in the compose override, a dependency for u4 and u5 (Q3: A)
- The pipeline runs format, lint, type check, tests with the 85% floor, the C2 contract check and a build check; nothing is deployed or published (Q4: A)
- Monitoring is the request log line and the Backstage readiness route only (Q5: A)

- Looks correct
- Request changes

[Answer]: Looks correct
