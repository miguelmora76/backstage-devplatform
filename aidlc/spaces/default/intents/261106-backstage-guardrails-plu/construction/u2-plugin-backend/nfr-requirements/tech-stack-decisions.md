# Tech Stack Decisions — u2-plugin-backend

Sources: `requirements.md` (constraints: TypeScript on Backstage's backend system; local only, hosting later possible; NFR1 view time, NFR2 coverage, NFR6 style, NFR7 repeatability), `functional-spec.md` and `rules.md` (BR3.4 decision order, BR7.1–BR7.3 timeouts and release, BR8.1 PostgreSQL), `contract-summary.md` (contract C1 interface, C2 server tools, C3 settings and sign-in), `team-practices.md` (tests first, 85% coverage, Prettier and ESLint, docker compose) and answers Q1–Q2 in `nfr-requirements-questions.md`.

## Quality Targets

Targets for performance, scale and operation are set here because this unit's stage produces no separate documents for them. All times are measured on the backend with the seeded data set and a local database, on a developer laptop.

| ID | Target | Measure and pass condition |
|---|---|---|
| NFR1.1 | Reads of changes and of the audit log answer in at most 300 ms at the 95th percentile. | 20 consecutive reads of each against the seeded set; the 95th percentile is at most 300 ms. Keeps each view well inside the 5-second target of NFR1. |
| NFR1.2 | A decision (approve, reject or retry) answers in at most 1 second plus the guardrails server's own time. | Measured with the stand-in server answering in 200 ms; the 95th percentile is at most 1.2 seconds. |
| NFR1.3 | The plan and failed-run reads add at most 200 ms to the server's answer. | Measured against a stand-in server with a fixed delay; the extra time at the 95th percentile is at most 200 ms (health probe reuse, BR7.1, keeps it low). |
| NFR1.4 | The audit read stays fast at 100,000 entries. | With 100,000 entries in one service's log, a filtered page read still meets NFR1.1; the table is indexed for the service-and-time read. |
| NFR1.5 | At least 10 requests at the same time run without error. | A test sends 10 simultaneous mixed requests and none fails. |
| NFR1.6 | The backend needs no more than 512 MB of memory beyond Backstage's own. | Measured during the concurrency test of NFR1.5. |
| NFR1.7 | When 10 callers decide the same change at once, exactly one wins. | A test with 10 simultaneous approvals on a pending change on real PostgreSQL gives one applied change, nine ALREADY_DECIDED refusals, and one applied audit entry plus nine refused entries (BR3.4, BR3.5). |
| NFR1.8 | A stuck claim is released within 30 seconds and the page shows it. | A test leaves a claim older than 30 seconds, reads the changes, and finds the change failed with the message Interrupted and its audit entry (BR7.3). |

## Decisions

| ID | Decision | Choice | Rationale |
|---|---|---|---|
| NFR2.1 | Language and runtime | TypeScript on a current long-term-support Node.js release, version pinned in the lock file | The stated constraint; one toolchain with the server and the UI |
| NFR2.2 | Plugin shape | A Backstage backend plugin on the new backend system, registered as `guardrails` (contract C3), serving its routes with Backstage's HTTP router service | Required by the constraint; reads the signed-in identity through Backstage's own services |
| NFR2.3 | Store | PostgreSQL through Backstage's database service, using its query builder; the claim and the release are single conditional updates | BR8.1 and BR3.4 need an atomic conditional update that survives a restart |
| NFR2.4 | Database changes | Versioned migrations run at start-up by the plugin | A clean checkout reaches the right tables with no manual step (FR8.1) |
| NFR2.5 | Guardrails server client | The official Model Context Protocol TypeScript kit as a client over streamable HTTP, with the read and write timeouts from settings and no automatic retries | Contract C2 and BR7.2; the same kit as the server keeps the two close |
| NFR2.6 | Demo sign-in | A custom Backstage sign-in provider `demo` in the auth backend, enabled by `guardrails.demoSignIn.enabled` (default off), giving the identity `user:default/<userId>` | Contract C3 (Q5: A of Contract Design); the switch is the control for the accepted risk (NFR5.3) |
| NFR2.7 | Configuration | App-config keys only: `guardrails.server.url`, `guardrails.server.readTimeoutMs`, `guardrails.server.writeTimeoutMs`, `guardrails.demoSignIn.enabled`, and the database login through Backstage's own database settings | Contract C3; no address, path or login written in code (hosting-later check) |
| NFR2.8 | Tests and coverage | Backstage's usual test runner with its coverage report; a failing test written before the code for each layer; at least 85% line coverage on the plugin code, enforced in CI | Team practice and NFR2 |
| NFR2.9 | Database in tests | Rule tests (claim, release, repair, append-only, concurrent decisions) run against a real PostgreSQL started for the run, a service container in CI; all other tests use an in-memory stand-in for the store behind the same interface | Answer Q1: A; these rules only mean something on a real engine |
| NFR2.10 | Logging | One line per request on standard output: time, route, actor id, status, error code and duration; plus a line when a claim is released or an audit entry is rebuilt. Never a reason text, setting value or login | Operation by one person (the demo); NFR5.8 |
| NFR2.11 | Health | The backend reports ready through Backstage's readiness route, which waits for the migrations; the guardrails server's reachability is not part of readiness because reads of changes and the audit log work without it (BR5.5) | Contract C4; contract Q2: A |
| NFR2.12 | Packaging | The plugin is built as a package of the same workspace and ships inside the Backstage backend image owned by u4 and u5 | Keeps one lock file and one CI setup; no separate service |
| NFR6.1 | Formatting and linting | Prettier and ESLint with Backstage's usual settings, enforced in CI | NFR6 and team practice |
| NFR7.1 | Demo users are fixed | The three users (sam, priya, alex) and their roles are in code and identical on every start (BR1.2); the data they see comes from the seeded server (u1, NFR7) | Same demo on every run |

## Alternatives Considered

| Alternative | Why not |
|---|---|
| In-memory stand-in for the store in every test (Q1: B) | Cannot show that exactly one caller wins the claim or that the release is atomic |
| SQLite for the sample | A second engine to keep consistent with PostgreSQL (BR8.1 chose PostgreSQL); hosting later would change engines |
| A separate service for the backend | Adds a container and a network hop for one user; the Backstage backend already hosts plugins |
| Demo sign-in always on (Q2: B) | Removes the control that keeps a hosted copy from opening to anyone |
| Retrying server calls inside the backend | Rejected by contract C2 and BR7.2; the user retries from the UI |

## Notes for Later Stages

- Exact versions are chosen when the plugin package is created in Code Generation and recorded in the lock file.
- NFR Design turns the choices above into patterns: the store interface and its two implementations, the claim and release statements, the identity reading and the log line.
