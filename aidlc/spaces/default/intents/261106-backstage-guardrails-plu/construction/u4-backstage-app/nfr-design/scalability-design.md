# Scalability Design — u4-backstage-app

Sources: `scalability-requirements.md` (NFR1.5, NFR1.6), `tech-stack-decisions.md` (NFR2.12, NFR2.13), `functional-spec.md` (BR2.6, BR3.4, BR4.1, BR4.3, BR4.5, D4), `performance-requirements.md`, `reliability-requirements.md` and `contract-summary.md` (C3 settings).

There is no load to plan for: one viewer on a laptop and ten catalog entries. The design only makes sure nothing blocks more than one copy later.

## Patterns

| ID | Pattern | Meets | How it works |
|---|---|---|---|
| SC1 | **Stateless app** | NFR1.5 | The sign-in token lives in the browser's memory (`IdentityHolder`), the catalog is a committed file read at start-up, and plugin data lives in the database. The backend process keeps no session, cache or counter. A lint rule (`no-restricted-syntax` on top-level `let` and `export let`) in `packages/app` and `packages/backend` keeps modules free of mutable shared state; the one place that holds a value for the page's life is the identity closure created per app instance, which is browser-side. |
| SC2 | **Shared database when compose is used** | NFR1.5 | Compose supplies PostgreSQL through environment variables, so a second backend copy would share the data. In-memory SQLite is for plain local development only and is never described as a scaling choice. |
| SC3 | **Everything that differs by host is a setting** | NFR1.6 | The guardrails server address, the database and the app's base addresses come from the environment (BR4.1, BR4.3, BR4.5), so hosting later changes settings, not code. |

## Capacity

| Item | Value | Note |
|---|---|---|
| Viewers | one at a time | no projection |
| Catalog entries | ten | file read once |
| Backend copies | one | a second copy would need only the shared database |

## Not Designed

No scaling target is set for the sample (NFR1.6); this is recorded so a later hosting effort knows it was a choice. No auto-scaling, load balancing, partitioning or queueing.
