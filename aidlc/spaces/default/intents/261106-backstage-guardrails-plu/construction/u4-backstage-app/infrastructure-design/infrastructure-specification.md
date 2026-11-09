# Infrastructure Specification — u4-backstage-app

Sources: `performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md` and `logical-components.md` of this unit's NFR Design, `components.md` (the app host and the plugin components), `functional-spec.md` (settings table, W1, D4, D8, D10) and `contract-summary.md` (C3 settings and sign-in, C4 readiness route), and answer Q1 in `infrastructure-design-questions.md`.

The app needs no cloud resource. It is a backend process that also serves the built frontend, plus a database. The compose files and the image build belong to u5; minikube files belong to u6. This document says what those units must provide.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | One backend process (Node) that serves the plugin routes and, in the compose run, the built frontend; the guardrails server (u1) runs as a second process | Two packages, one backend (D10) |
| Run modes | **Development** (`start:local`): the frontend dev server on its own port plus the backend, so two origins (`APP_BASE_URL=http://localhost:3000`, `BACKEND_BASE_URL=http://localhost:7007`). **Compose** (u5): the backend serves the built frontend, so one origin; u5 sets `APP_BASE_URL` and `BACKEND_BASE_URL` to the same value (the published address of the backend). | `APP_BASE_URL` is always the single CORS origin and the origin of the content policy (S6, S9); in compose the two values are equal, so the browser talks to one origin only |
| Networking | Both base addresses are settings with the development values above; the backend reaches the guardrails server at `GUARDRAILS_SERVER_URL`; the browser reaches only `BACKEND_BASE_URL` (and the dev server in development) | No address in code or in a committed file (S4) |
| Storage | Plugin data in PostgreSQL when the PostgreSQL settings file is added to the start command (see Database Selection); in-memory SQLite otherwise; the catalog is a committed file read at start-up | SC2, R1; the catalog is not a store |
| Environments | One: the developer laptop with docker compose; minikube is optional and handled by u6 | Team practices: local only |
| IaC approach | None for cloud; the settings files and `.env.example` are the whole configuration surface; compose and minikube files are u5 and u6 | Nothing to provision |
| Resource sizing | None set; one viewer, ten catalog entries (SC1, SC2) | No scaling target (NFR1.6) |
| Image | Built by u5 from the output of `app-build`; this unit supplies the build output and the start command | NFR2.13 |
| Start command | The backend entry point built from `backendFeatures`; exits non-zero on a failed start (R2); readiness at `/.backstage/health/v1/readiness` | R2, R4 |

## Environment Variables

One list, shared by `.env.example`, the compose override (u5), the README and `checkShippedSettings` (Q1: A). Names for the app addresses and the database are fixed here so u5 can use them.

| Variable | Setting it fills | Required | Default or example in `.env.example` |
|---|---|---|---|
| `GUARDRAILS_SERVER_URL` | `guardrails.server.url` | Yes; a missing value stops the start (R2) | `http://localhost:7100` (the u1 server's local address as u1 documents it) |
| `GUARDRAILS_DEMO_SIGN_IN` | `guardrails.demoSignIn.enabled` | No; false when unset | `false`, the shipped default (contract C3). The `start:local --demo` option sets it to `true` for that run only; u5's compose override sets it to `true` |
| `APP_BASE_URL` | `app.baseUrl` and the one CORS origin | No | `http://localhost:3000` (development); compose sets it equal to `BACKEND_BASE_URL` |
| `BACKEND_BASE_URL` | `backend.baseUrl` | No | `http://localhost:7007` |
| `BACKEND_PORT` | the backend listen port | No | `7007` |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `backend.database.connection` in the PostgreSQL settings file only | All five required when that file is used; not read otherwise | Not in `.env.example` as values; commented placeholders only. Compose supplies them from its own env file; never committed |

`.env.example` holds the names above with the safe values shown and no password. A `start:local` script copies nothing by itself: the README says to copy it to `.env`, and the script loads that file before starting both packages. `.env` is gitignored. `checkShippedSettings` reads `.env.example` too and fails on any password value or foreign host name. The settings check treats the variables as two groups: the core group (every name above except the PostgreSQL five) must be present in `.env.example`; the PostgreSQL five are checked only in the PostgreSQL settings file, where each must be a required substitution with no default and no literal.

## Database Selection

| Item | Choice |
|---|---|
| Files | `app-config.yaml` (shipped, in-memory SQLite) and `app-config.postgres.yaml` (shipped, sets `backend.database.client: pg` and the connection from the five `POSTGRES_*` substitutions) |
| Owner | u4 owns both files; u5 only chooses which to load |
| Switch | Backstage merges config files in order: the start command `--config app-config.yaml --config app-config.postgres.yaml` selects PostgreSQL; the plain command selects SQLite. u5's compose command uses the two-file form |
| Check | `checkShippedSettings` reads both files; the start-up test runs with the first file only (SQLite); the PostgreSQL file is checked for substitutions and absence of literals, and its live use is proved by u5's compose run |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| PostgreSQL (compose, u5) | database for `plugin-guardrails-backend` | Version and volume set by u5; credentials from the environment variables above | The plugin runs its migrations at start (W1); readiness stays not-200 until they finish (R4) |
| In-memory SQLite | database for plain local runs | `better-sqlite3` in memory; lost on restart | Not a scaling choice (SC2) |
| Guardrails server (u1) | upstream HTTP service | Reached through `GUARDRAILS_SERVER_URL` | The app starts without it (R3) |
| Auth backend | token issuer for the demo sign-in | Part of the app backend; provider present only when the switch is on | D8 (whether `auth.providers.demo` is needed) is confirmed in Code Generation |

No cache, queue, search, CDN, DNS or load balancer is needed.

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| GitHub Actions workflow file | u1-data-and-server (created), extended by each unit | u2, u3, u4, u5 | This unit adds only `app-*` jobs |
| Environment variable names, `.env.example` and the two settings files | u4-backstage-app | u5 (compose override), u6 | u5 and u6 use these names, set the values listed under Run Modes and Database Selection, and do not rename or edit the files; a new variable is added here first |
| Readiness route | u4-backstage-app (Backstage's own) | u5 (compose waits for it) | Read only |
| PostgreSQL database and volume | u5-compose-and-ci | u2's plugin through u4's settings | The app reads credentials from the environment only |
| Catalog file | u4-backstage-app | the app at start-up | Written by the catalog script from the u1 generator; seed 20261106 |

## Hosting Later

Nothing here blocks hosting: every address, the database and the demo switch are settings. Before any hosted use the passwordless demo provider must be replaced, the content policy and CORS origin set to the real address, and the database moved to a managed service. These are listed in the README.
