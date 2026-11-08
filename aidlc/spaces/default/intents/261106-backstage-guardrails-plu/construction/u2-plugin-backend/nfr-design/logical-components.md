# Logical Components — u2-plugin-backend

Sources: `security-design.md` (this stage), `tech-stack-decisions.md` and `security-requirements.md` (NFR1.1–NFR1.8, NFR2.1–NFR2.12, NFR5.1–NFR5.10), `functional-spec.md` and `rules.md` (workflows and rules BR1.1–BR8.1) and `contract-summary.md` (contracts C1, C2, C3). This is the component-level view of where the NFR patterns apply. It lists what the plugin is made of, what can fail, and what each failure affects. Deployment pieces (images, compose services) are decided in Infrastructure Design.

## Components

| Component | Responsibility | NFR patterns applied |
|---|---|---|
| Identity guard | Turns the sign-in credentials into an actor (user id, name, role); refuses anything that is not a demo user principal | NFR5.1, NFR5.2 |
| Input check | Validates the shape of every route's input and drops unknown fields | NFR5.6 |
| Demo sign-in module | The `demo` sign-in provider and the open demo-user list; registered only when the setting is on, start-up warning when on | NFR2.6, NFR5.3 |
| Allowed-action rules | Pure function: actor, change, reachability and claim state to each action with its ordered reason | NFR5.4 |
| Change workflow | Propose and decide in the order of BR3.4; maps outcomes to responses | NFR1.2, NFR1.7, NFR5.9 |
| Change store | Interface with a PostgreSQL implementation (used at runtime) and an in-memory one (tests); claim and final write as conditional updates | NFR2.3, NFR2.9, NFR1.7, NFR5.10 |
| Audit store | Interface with append and read only; table with an error-raising trigger against update and delete; index for service and time | NFR5.5, NFR1.4 |
| Recovery | Releases a claim older than 30 seconds and rebuilds a missing entry; runs on the first read or decision, with a clock the tests control | NFR1.8, NFR5.9 |
| Guardrails client | MCP client over streamable HTTP; 3 second reads, 10 second writes, no retry; maps tool errors to failures | NFR2.5 |
| Server health | The health probe with its 5 second reuse; concurrent reads share one probe | NFR1.3 |
| Request logger | One line per request with the fixed fields; no values from the request | NFR2.10, NFR5.8 |
| Error handler | Fixed 500 for anything unexpected; no internal detail | NFR5.9 |
| Settings reader | Reads `guardrails.*` keys and the database login from Backstage settings | NFR2.7, NFR5.8 |

## Failure Domains and Blast Radius

| Failure | What stops | What keeps working |
|---|---|---|
| Guardrails server down or slow | Plan and failed-run reads (503); all writes, including reject, are refused with SERVER_UNREACHABLE (BR7.7) | Reads of changes, the audit log, the signed-in user and the user list (BR5.5) |
| Guardrails server forced to fail | An approve or retry ends as a failed change with its entry | Everything else; retry stays available because the probe still answers (BR7.1) |
| Database down | Every route except the open user list; each returns the fixed 500 | The backend process and Backstage's other plugins |
| A decision interrupted after the claim | That one change until the next read or decision after 30 seconds, then failed with Interrupted | All other changes |
| An audit append fails after the change is written | Nothing visible to other callers; the user sees an error | The entry is rebuilt at the next read or decision (BR7.4) |
| Health probe cache wrong for up to 5 seconds | Allowed actions may be off for at most 5 seconds; a write is re-checked by the probe at the time (BR7.7) | Reads |

## Shared Resources

- The database connection pool belongs to Backstage and is shared with other plugins; the plugin uses short single-statement or single-transaction work and holds no connection across a server call, so a slow guardrails server never holds a database connection.
- The MCP client keeps one connection to the guardrails server; the 10 second write timeout is below the 30 second claim release, so a stuck call is always over before its claim is released.

## Isolation Notes

- The plugin shares the Backstage backend process, so memory and processor limits are Backstage's; the plugin's own target is at most 512 MB beyond Backstage (NFR1.6), checked in the concurrency test.
- The in-memory change store is a test double behind the same interface; the plugin does not use it unless a test setting selects it (NFR5.10).

## Notes for Later Stages

- Infrastructure Design maps the database to a compose service, adds a second compose service for local test runs, and places the demo sign-in override in the compose settings.
- Code Generation builds the components in this order, tests first: Input check and Allowed-action rules (pure), Change store and Audit store (real PostgreSQL tests), Guardrails client with a stand-in server, Change workflow, Recovery, Identity guard and Demo sign-in, Request logger and Error handler, then the routes.
