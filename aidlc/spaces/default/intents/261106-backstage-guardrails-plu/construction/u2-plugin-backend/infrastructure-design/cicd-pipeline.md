# CI/CD Pipeline — u2-plugin-backend

Sources: `team-practices.md` (pull requests, CI before merge and green, Prettier and ESLint, 85% coverage, nothing deploys automatically, docker compose locally), `requirements.md` (FR10.1, NFR2, NFR6), `security-design.md` and `logical-components.md` (NFR Design for this unit), `tech-stack-decisions.md` (NFR2.9 real PostgreSQL for the rule tests), `contract-summary.md` (contract C2 and the C3 settings) and answers Q1–Q5 in `infrastructure-design-questions.md`. This unit has no container, no cloud resource and no monitoring stack of its own, so it owes only this pipeline document: its jobs join the shared GitHub Actions workflow, which this unit does not own. The deployment shape, the database service and the monitoring are described below only where they affect the pipeline.

This unit has no separate performance-design, scalability-design, reliability-design or observability-design documents (their targets and patterns are in `tech-stack-decisions.md`, `security-design.md` and `logical-components.md`). The component catalogue `components.md` (ChangeWorkflow, AuditLog, DemoIdentity) and `functional-spec.md` (workflows W1 to W8) set what the pipeline's tests cover: stages 4 and 5 test each component and each workflow.

## Deployment Shape Used by the Pipeline

| Facet | Choice |
|---|---|
| Packaging | A package of the same workspace, built into the Backstage backend image owned by u4 and u5 (Q1: A, NFR2.12) |
| Database at run time | A PostgreSQL service in the compose file written in u5, with a named volume so changes and audit entries survive a restart (Q2: A, NFR5.10) |
| Database in local tests | A throw-away PostgreSQL service in a compose file kept with this unit's tests, started by one documented command, removed afterwards (Q2: A, NFR2.9) |
| Database in CI | A PostgreSQL service container of the CI job (Q2: A, NFR2.9) |
| Monitoring | The request log line on standard output and Backstage's readiness route only; no metrics, alerts or dashboards (Q5: A, NFR2.10) |

## Build and Test Stages

The workflow runs on every pull request and on every push to `main`. A failed job fails the pull request (FR10.1).

| Stage | What it does | Gate |
|---|---|---|
| 1. Format | Prettier check over the plugin code (NFR6.1) | Any difference fails |
| 2. Lint | ESLint with Backstage's usual settings | Any error fails |
| 3. Type check | TypeScript compile without output | Any error fails |
| 4. Unit tests | All tests that use the in-memory store: input check, allowed-action rules, workflow, identity guard, log line, error handler, settings (NFR2.8) | Any failing test fails |
| 5. Rule tests on PostgreSQL | The claim, release, repair, append-only trigger, restart and concurrency tests (NFR1.7, NFR1.8, NFR5.5, NFR5.10, NFR1.5) against the PostgreSQL service container | Any failing test fails |
| 6. Coverage | Coverage report over the plugin code from stages 4 and 5 together | Line coverage below 85% fails (NFR2, team practices) |
| 7. Contract check | Checks the stand-in server against the C2 spec kept by u1, and the route list against the C1 interface file (NFR2.5) | Any mismatch fails |
| 8. Package build | Builds the plugin and the backend package that includes it | Build failure fails |

Stages 1 to 3 run in parallel; 4 and 5 run after them; 6 runs after 4 and 5; 7 and 8 run in parallel with 4 and 5. Stage 5 needs only the PostgreSQL service container of the job; no Docker-in-Docker is needed.

## Deployment Strategy

None. Nothing deploys automatically (team practices) and the package is neither pushed nor published anywhere (Q4: A). The way the sample runs is the compose command defined in u5-compose-and-ci.

## Rollback

There is nothing to roll back in an environment. A bad change is undone by reverting its pull request on `main`; the next pipeline run checks the revert. Database changes are forward-only migrations; for the sample, a reset is removing the named volume.

## Environment Promotion

None: there is one environment, the developer laptop. If hosting is added later, a promotion path is a new design; the address and timeouts of the guardrails server and the database login are settings, so no code changes for it (contract C3).

## Secrets in the Pipeline and the Sample

- The pipeline needs no secret: it pushes nothing and calls no outside service. The PostgreSQL service container uses a throw-away password written in the workflow file, valid only inside the job.
- The only secret in the sample is the database password. It is an environment variable with a sample value in the compose file, never in code or app-config files (Q3: A, NFR5.8).
- The demo sign-in is off in the shipped app-config and on only in the compose override. This is a dependency for u4 and u5: u4 keeps the shipped default off, u5 sets it on in the compose override (NFR5.3). A start-up check in the plugin logs a warning when it is on.

## Branching

Each Bolt is its own short-lived branch merged through a pull request after review (team practices). The required checks are stages 1 to 8.

## NFR to Infrastructure Mapping

| ID | Where it lands |
|---|---|
| NFR1.1 | Read-time test in stage 5 against PostgreSQL with the seeded set; no infrastructure beyond the database |
| NFR1.2 | Decision-time test in stage 5 with the stand-in server answering after 200 ms |
| NFR1.3 | Test in stage 4 with a stand-in server delay and a cached probe; no infrastructure |
| NFR1.4 | Stage 5 loads 100,000 audit entries into the PostgreSQL service container and checks the read time |
| NFR1.6 | Memory is measured in the concurrency test of stage 5; no container limit is set by this unit |
| NFR1.7 | Stage 5 concurrency test with ten simultaneous decisions on PostgreSQL |
| NFR1.8 | Stage 5 release test using a clock the test controls |
| NFR2.1 | Node.js release pinned in the lock file and the workflow |
| NFR2.3 | PostgreSQL as a compose service with a named volume, a throw-away service for local tests, and a CI service container |
| NFR2.5 | Stage 7 contract check against the C2 spec |
| NFR2.6 | The demo sign-in setting: off in shipped config, on in the compose override |
| NFR2.7 | Server address, timeouts and database login are settings supplied by compose, none in code |
| NFR2.9 | Stage 5 on a real PostgreSQL; the local test compose service |
| NFR2.10 | The request log line on standard output, read with the compose logs command; no other monitoring |
| NFR2.12 | Built into the Backstage backend image by u4 and u5; stage 8 checks that it builds |
| NFR5.1 | Code only (identity guard); tested in stage 4 |
| NFR5.2 | Code only (identity guard); tested in stage 4 |
| NFR5.3 | Shipped default off and compose override on (above) |
| NFR5.4 | Code only (allowed-action rules); tested in stage 4 |
| NFR5.5 | The audit table trigger is created by a migration and tested in stage 5 |
| NFR5.6 | Code only (input check); tested in stage 4 |
| NFR5.7 | Code only (bound parameters); tested in stage 5 with hostile text |
| NFR5.8 | No secret in code, image or workflow; the log test in stage 4 checks the log line |
| NFR5.9 | Stage 5 test that forces a failure after the claim and passes the 30 seconds with a controlled clock |
| NFR5.10 | Named volume for PostgreSQL in compose; stage 5 restart test |

## Dependencies on Other Units

- The workflow file and its first four jobs are created with the first Bolt built (the workspace and pipeline setup in the Bolt plan); this unit adds stages 4 to 8 for its package.
- u1-data-and-server owns the C2 spec and its contract check; this unit runs the same check against its stand-in (stage 7).
- u4-backstage-app keeps the shipped demo sign-in default off and supplies the settings keys of contract C3; u5-compose-and-ci adds the PostgreSQL service with its named volume, the demo sign-in override and the sample database password.
