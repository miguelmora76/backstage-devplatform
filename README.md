# Backstage guardrails sample

A sample project that puts a guardrails tool server inside a Backstage service catalog. It surfaces two kinds of work for a service, **dependency-upgrade planning** and **CI failure triage**, on the service's catalog page, and it lets a person propose and decide changes through an **approval-gated write flow** with an **audit log** that is visible in the UI.

Everything runs on invented data and locally (docker compose, with minikube as an option). Nothing here is deployed automatically, and nothing is meant to be hosted without the changes listed under [Known limits](#known-limits).

> **Read this first: the demo sign-in is passwordless.** When it is on, anyone who can open the page can sign in as any of the three demo users. It is off unless you turn it on, and it must be replaced with a real sign-in provider before any hosted use. See [The demo users and the sign-in risk](#the-demo-users-and-the-sign-in-risk).

## Contents

- [What is in the project](#what-is-in-the-project)
- [How the parts fit together](#how-the-parts-fit-together)
- [The demo users and the sign-in risk](#the-demo-users-and-the-sign-in-risk)
- [Quick start](#quick-start)
- [Settings and environment variables](#settings-and-environment-variables)
- [Run modes](#run-modes)
- [The catalog and the seed](#the-catalog-and-the-seed)
- [Testing](#testing)
- [Continuous integration](#continuous-integration)
- [Folder layout](#folder-layout)
- [Contracts between the units](#contracts-between-the-units)
- [Known limits](#known-limits)
- [Troubleshooting](#troubleshooting)
- [Status of the units](#status-of-the-units)

## What is in the project

The project is built from six units of work. Each unit has its own design record under `aidlc/` and its own tests.

| Unit | Package or folder                               | What it is                                                                                                      |
| ---- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| u1   | `packages/guardrails-server`                    | A synthetic MCP server with four tools, and the seeded generator that feeds it                                  |
| u2   | `packages/plugin-guardrails-backend`            | The Backstage backend plugin: change workflow, approvals, append-only audit log, demo sign-in provider          |
| u3   | `packages/plugin-guardrails`                    | The Backstage frontend plugin: overview card, Guardrails tab, change detail, demo-user switch                   |
| u4   | `packages/app`, `packages/backend`              | The host Backstage app: loads both plugins, the demo sign-in page, the catalog of the seeded services, settings |
| u5   | compose files and the CI workflow (in progress) | Runs the whole sample with docker compose, the real-browser checks and the shared CI workflow                   |
| u6   | Kubernetes run files (optional, not started)    | Runs the sample on minikube                                                                                     |

This README was started in u4, the first unit where the whole application runs. It is kept in step with the code: a unit that changes how the project is run updates it in the same change.

## How the parts fit together

```mermaid
graph LR
  Browser[Browser: Backstage app] -->|sign in: open user list, start address| Auth[Auth backend + demo provider]
  Browser -->|plugin calls with the demo token| Plugin[plugin-guardrails-backend]
  Plugin -->|MCP over HTTP| Server[guardrails-server]
  Plugin --> DB[(Database)]
  Browser --> Catalog[Catalog: committed file]
```

Text fallback: the browser shows the Backstage app (u4) with the guardrails frontend plugin (u3). It signs in through the auth backend's demo provider (u2's sign-in module, loaded by u4). The frontend plugin calls the guardrails backend plugin (u2) with the demo user's token. The backend plugin keeps changes and the audit log in a database and reaches the guardrails server (u1) only through its four MCP tools. The catalog lists the seeded services from a committed file.

What the app decides and what it does not:

- **The backend plugin decides every rule**: who may propose or decide, which status allows which action, one decision per change, no self-approval, what is audited. The browser only shows what the backend says is allowed.
- **The app (u4) holds wiring and configuration only.** It contains no business rule.
- **The audit log is append-only.** There is no route that edits or deletes an entry.

## The demo users and the sign-in risk

There are three invented users. The sign-in page lists them with their roles and nothing else; you pick one and you are signed in with no password.

| User  | Role              | What the role means in the sample                                                    |
| ----- | ----------------- | ------------------------------------------------------------------------------------ |
| Sam   | Service owner     | May propose changes, and approve, reject or retry changes that someone else proposed |
| Priya | Platform engineer | The same as Sam: may propose, and decide changes that someone else proposed          |
| Alex  | Auditor           | Read only: can look at everything and change nothing                                 |

Nobody may decide their own change (no self-approval), so a change needs a second person. The exact rules (one decision per change, refusal reasons, what state allows what) are enforced by the backend plugin and described in its README (`packages/plugin-guardrails-backend/README.md`).

The risk, stated plainly:

- **Anyone who can reach the page can become any demo user** while the demo sign-in is on. That is acceptable for a laptop demo and for nothing else.
- It is **off by default**. The shipped setting is `GUARDRAILS_DEMO_SIGN_IN` with the default `false`. When it is off, the provider and the open user list do not exist, and the sign-in page says so.
- When it is on, the backend logs one warning line at start-up.
- The token is kept **in memory only**: never in browser storage, an address, a log line or the page text. Reloading the page signs you out, and an expired token shows the plugin's "session ended" text; the app does not renew it silently.
- **Replace the provider before any hosted use** (see [Known limits](#known-limits)).

## Quick start

You need Node.js 22 or later and Yarn classic (1.x). Docker is only needed for the compose run (unit u5).

```bash
# 1. install everything
yarn install

# 2. build the guardrails server (the catalog script and some tests use its generator)
yarn workspace guardrails-server build

# 3. start the guardrails server on port 7100 (leave it running in its own terminal)
PORT=7100 node packages/guardrails-server/dist/main.js

# 4. set up local settings
cp .env.example .env      # GUARDRAILS_SERVER_URL already points at port 7100

# 5. start the app (backend on 7007, frontend dev server on 3000), demo sign-in on for this run
yarn start:local --demo
```

Open `http://localhost:3000`. You see the sign-in page. Pick a user, then open a service in the catalog (for example `catalog-portal`): the overview shows the Guardrails card and the **Guardrails** tab shows the upgrade plan, failed CI runs, changes and the audit log.

Stop both processes with Ctrl+C. The database is in memory, so changes and audit entries are lost on restart.

## Settings and environment variables

The shipped settings are in `packages/backend/app-config.yaml`. Every value that differs between machines is filled from an environment variable, and **no secret and no guardrails server address is written in any committed file**. `.env.example` lists the names with safe local values; copy it to `.env` (git ignores `.env`). What is already set in your shell wins over `.env`.

| Variable                                                                              | Fills                                                | Required                               | Default / example                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `GUARDRAILS_SERVER_URL`                                                               | `guardrails.server.url`                              | **Yes**, no default                    | `http://localhost:7100` in `.env.example`                                   |
| `GUARDRAILS_DEMO_SIGN_IN`                                                             | `guardrails.demoSignIn.enabled`                      | No; **off unless set to `true`**       | `false`. `yarn start:local --demo` sets `true` for one run                  |
| `APP_BASE_URL`                                                                        | `app.baseUrl` and the one allowed browser origin     | No                                     | `http://localhost:3000`                                                     |
| `BACKEND_BASE_URL`                                                                    | `backend.baseUrl`                                    | No                                     | `http://localhost:7007`                                                     |
| `BACKEND_PORT`                                                                        | The backend's listen port                            | No                                     | `7007`                                                                      |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `backend.database.connection` (PostgreSQL file only) | All five, only when PostgreSQL is used | Not set locally; the compose files supply them. **Never commit a password** |

A missing `GUARDRAILS_SERVER_URL` stops the backend at start-up with a message that names `guardrails.server.url` (never a value) and a non-zero exit code, so a compose run shows the failure.

### Databases

- **Plain local runs** use an in-memory SQLite database (`app-config.yaml`). Nothing to install; data is lost on restart.
- **PostgreSQL** is selected by adding the second settings file: `--config app-config.yaml --config app-config.postgres.yaml`. That file holds only the five `POSTGRES_*` substitutions. The compose run (u5) does this.

### Security headers and browser origin

- The backend accepts browser calls only from the app's own address (`APP_BASE_URL`): one origin, no wildcard.
- A content policy (`backend.csp`) allows scripts, styles and connections only from the app and the backend's own addresses, with no wildcard host. **`unsafe-eval` is allowed for scripts only**, because Backstage's own entity page fails with an `EvalError` without it (found in a real browser run). This is a known, recorded deviation from a stricter design; see [Known limits](#known-limits).

## Run modes

| Mode                                  | How                                                                                                         | Origins                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Development** (`yarn start:local`)  | Frontend dev server on port 3000 plus the backend on port 7007                                              | Two origins; `APP_BASE_URL=http://localhost:3000` is the allowed origin |
| **Backend serves the built frontend** | `yarn workspace app build`, then start only the backend (see below); the backend serves `packages/app/dist` | One origin; set `APP_BASE_URL` and `BACKEND_BASE_URL` to the same value |
| **Compose** (u5)                      | The compose files run the guardrails server, the app and PostgreSQL                                         | One origin; u5 sets both base URLs equal                                |

Run the backend alone (it serves the built frontend), from the repository root:

```bash
yarn workspace app build
cd packages/backend
GUARDRAILS_SERVER_URL=http://localhost:7100 GUARDRAILS_DEMO_SIGN_IN=true \
  APP_BASE_URL=http://localhost:7007 BACKEND_BASE_URL=http://localhost:7007 \
  node --require @backstage/cli/config/nodeTransform.cjs src/index.ts --config app-config.yaml
```

Run the backend **from `packages/backend`** (as `yarn workspace backend start` does): the catalog file location in the settings is relative to that folder.

## The catalog and the seed

The catalog holds ten entries, read from the committed file `packages/backend/catalog/guardrails-catalog.yaml` and read-only in the app:

- six service **Components**, named exactly as the seed names its services,
- three **User** entities for the demo users,
- one **Group**, `guardrails-demo`, which owns every service and has the three users as members.

A script writes the file from the guardrails server's generator, so the catalog cannot drift from the data:

```bash
yarn workspace guardrails-server build
yarn workspace backend catalog:write --out catalog/guardrails-catalog.yaml   # default seed 20261106
yarn workspace backend catalog:write --seed 12345 --out catalog/other.yaml   # another seed
```

A test fails when the committed file differs from the script's output for the default seed. **The committed catalog matches the default seed only.** If you run the guardrails server with another `GUARDRAILS_SEED`, write the catalog again for that seed and point `catalog.locations` at it; otherwise some service pages will say a service is not found.

## Testing

The team practice is **test first** (a failing test before the code that makes it pass), with **at least 85% line coverage** on the project's own code, and CI must be green before merge.

Run these from the repository root.

| What                                        | Command                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| App (frontend) tests                        | `yarn workspace app test`                                                                   |
| App frontend coverage (85% line floor)      | `yarn workspace app test --coverage`                                                        |
| Backend tests except the start-up test      | `yarn workspace backend test --testPathIgnorePatterns startup`                              |
| Backend coverage (85% line floor)           | `yarn workspace backend test --coverage --testPathIgnorePatterns startup`                   |
| Start-up test (real features, test backend) | `yarn workspace backend test startup`                                                       |
| Catalog drift check                         | `yarn workspace backend catalog:check`                                                      |
| Settings check on the committed files       | `yarn workspace backend check:settings`                                                     |
| Package allow-lists                         | `yarn workspace backend check:packages` and `yarn workspace app check:packages`             |
| A failed start exits non-zero               | `yarn workspace backend check:exit`                                                         |
| Lint, type check, format                    | `yarn workspace app lint`, `yarn workspace backend lint`, `yarn tsc`, `yarn prettier:check` |

What the tests cover for u4:

- The sign-in page in every state (loading, choosing, demo off, load failed, starting, sign-in failed): texts, accessibility scans, keyboard use, hostile names shown as text, no token in storage, console or page text.
- The sign-in client's 5 second limits, the stale-answer drop and the single request for a double press.
- The start-up test: the real backend features with a stand-in guardrails server and a recording logger. It checks the readiness route, the open user list with the switch on and off, 401 for a service principal, an unknown user and no one, the server-down case (readiness stays 200, server routes answer 503), the demo warning line, that no token, password or reason text reaches the log, and the real auth backend's demo start address.
- The catalog builder and the settings check (with bad fixtures), the package allow-list script and the lint rules (with failing fixtures).

Not covered by these tests (checked by unit u5 in a real browser and with compose): colour contrast and real focus behavior, a screen-reader pass, the Chrome and Firefox walkthroughs, the 20-load timing, verifying a token issued by the real auth backend against the plugin end to end, and the CORS and content-policy headers in a deployed run (Backstage's test backend does not apply them).

## Continuous integration

`.github/workflows/ci.yml` is one shared workflow. It runs on every pull request and every push to `main`; nothing is deployed or published, and no secret is used. Jobs added for the app (u4):

| Job            | What it does                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `app-unit`     | One run of the unit tests of both packages (not the start-up test) with coverage; 85% line threshold in each package settings |
| `app-coverage` | Reads the coverage reports and fails below 85% line coverage in either package                                                |
| `app-startup`  | The start-up test                                                                                                             |
| `app-catalog`  | The catalog drift test, and two catalog writes compared byte for byte with each other and with the committed file             |
| `app-checks`   | The committed-settings check and the package allow-lists                                                                      |
| `app-build`    | Builds both packages and then starts the real backend with `GUARDRAILS_SERVER_URL` unset, expecting a non-zero exit           |

The shared `format`, `lint` and `typecheck` jobs also cover `packages/app` and `packages/backend`. The lint rules for these packages forbid raw HTML insertion, `console` output in the frontend, browser storage, module-level mutable state, and addresses or ports written in source.

## Folder layout

```
packages/
  guardrails-server/            u1  the synthetic MCP server and data generator
  plugin-guardrails-backend/    u2  backend plugin (workflow, audit, demo sign-in module)
  plugin-guardrails/            u3  frontend plugin (card, tab, change detail)
  app/                          u4  frontend app
    src/signin/                     sign-in page, state, client, identity holder
    src/signInModule.tsx            puts the sign-in page and the root redirect into the app
    src/features.ts                 the list of frontend features (catalog, sign-in, guardrails)
    allowed-packages.txt            the packages the app may depend on
  backend/                      u4  backend
    app-config.yaml                 shipped settings (SQLite in memory)
    app-config.postgres.yaml        adds PostgreSQL (five required variables)
    catalog/                        the committed catalog file
    src/features.ts                 the one list of backend features
    src/catalog/                    catalog builder and script logic
    src/settings/                   the check of the committed settings
    src/startup.test.ts             the start-up test
    scripts/                        check-packages, check-exit, start-local
    allowed-packages.txt            the packages the backend may depend on
.env.example                    names and safe local values for the settings
.github/workflows/ci.yml        the shared CI workflow
aidlc/                          the design record of every unit (requirements, designs, reviews)
```

## Contracts between the units

| Contract | Between       | What it fixes                                                                                              |
| -------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| C1       | u2 and u3     | The plugin backend's routes and error codes (`/api/guardrails/...`)                                        |
| C2       | u1 and u2     | The four MCP tools and their errors (`packages/guardrails-server/contract/c2-tools.json`)                  |
| C3       | u2, u3 and u4 | Plugin ids, the settings keys, the demo sign-in and its start address, the catalog names                   |
| C4       | u1, u4 and u5 | The guardrails server's port and seed, and the app's readiness route `GET /.backstage/health/v1/readiness` |

The full text is in `aidlc/spaces/default/intents/261106-backstage-guardrails-plu/inception/contract-design/contract-summary.md`.

## Known limits

- **Passwordless demo sign-in.** Replace the provider before any hosted use. It is off by default and the README, settings and a log line all say so.
- **`unsafe-eval` for scripts.** Backstage's pages need script evaluation, so the content policy allows it for `script-src` only. A stricter policy would need Backstage to stop evaluating strings; revisit it before hosting.
- **A reload signs you out.** The sign-in is held in memory by design and never renewed.
- **Data is lost on restart** with the in-memory database (plain local runs). Compose uses PostgreSQL with a volume.
- **The app has little styling of its own.** It uses Backstage's default theme and the pages are plain; visual polish is not part of this sample.
- **The catalog matches one seed.** See [The catalog and the seed](#the-catalog-and-the-seed).
- **Local only.** No hosted environment, no TLS, no managed database. The settings are written so hosting later changes settings, not code.

## Troubleshooting

| Symptom                                                 | Likely cause and fix                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| The backend stops at start with `guardrails.server.url` | `GUARDRAILS_SERVER_URL` is not set. Copy `.env.example` to `.env` or export it                                     |
| The sign-in page says the demo sign-in is off           | `GUARDRAILS_DEMO_SIGN_IN` is not `true`. Use `yarn start:local --demo`, or set it in `.env`                        |
| The sign-in page says the users could not be loaded     | The backend is not reachable from the browser, or did not answer in 5 seconds. Use Retry; check `BACKEND_BASE_URL` |
| `There is no .env file`                                 | Run `cp .env.example .env` at the repository root                                                                  |
| Service pages say a service is not found                | The guardrails server uses another seed than the committed catalog. See the catalog section                        |
| Browser calls fail with a CORS error                    | `APP_BASE_URL` does not match the address in the browser's address bar                                             |
| The Guardrails tab shows the server as unreachable      | The guardrails server is not running or `GUARDRAILS_SERVER_URL` is wrong. The rest of the app keeps working        |
| `catalog:write` fails to find the generator             | Build it first: `yarn workspace guardrails-server build`                                                           |

## Status of the units

u1, u2 and u3 are built and merged. u4 (this unit) adds the app, the catalog, the settings, the CI jobs and this README. u5 will add the compose files, the real-browser checks and the rest of the CI workflow, and extend this README with the compose run; u6 (minikube) is optional and not started.

## Run everything with docker compose

Added by unit u5. You need Docker with Compose v2 and Yarn; nothing else.

```bash
yarn install
yarn compose:up      # builds the three images, starts the sample, waits until it is healthy
```

Then open <http://localhost:7007> and choose a demo user. `compose:up` does everything itself: it creates `.env.compose` on the first run (a random database password, mode 0600, never printed, never committed), builds the app image and the guardrails server image, starts PostgreSQL, the guardrails server and the app in that order, and waits up to 180 seconds for all three to report healthy. On a failure it prints the status and the log of every service. The first build takes several minutes; later starts take well under a minute.

What runs: the app (Backstage backend with the built frontend) on `127.0.0.1:7007` only, the guardrails server and PostgreSQL on a network that is closed to the host and the internet. Every container runs as a non-root user without capabilities and with a read-only root file system; the only writable places are listed in `compose.yaml`. The data is invented and the seed is fixed at `20261106`; `compose:up` refuses to start when `GUARDRAILS_SEED` is set to anything else.

### Stopping and resetting

| Command              | What it does                                                                        |
| -------------------- | ----------------------------------------------------------------------------------- |
| `yarn compose:down`  | Stops the containers and **keeps** the database volume (changes and audit log stay) |
| `yarn compose:reset` | Stops the containers and **removes** the volume: the sample data is gone            |

If `.env.compose` is deleted while the volume still exists, `compose:up` stops and tells you to run `yarn compose:reset`, because a new password could not open the old database. Always call compose through these commands (or add `--project-name guardrails-sample --env-file .env.compose` yourself) so a `.env` meant for `yarn start:local` is never read.

### The demo sign-in risk in the compose run

The compose run turns the passwordless demo sign-in on (`GUARDRAILS_DEMO_SIGN_IN=true`): anyone who can open the page can become any of the three demo users. That is acceptable only because the port is published on the loopback address and the data is invented. Replace the demo provider and supply the database login from a secret store before any hosted use. The shipped settings still default the sign-in to off.

### The end-to-end checks

With the sample up (start from `yarn compose:reset` and `yarn compose:up` so the tables are empty):

```bash
yarn workspace e2e playwright install chrome firefox   # once
yarn e2e            # flows, accessibility, keyboard, accessibility tree, headers, token, audit, repeatability, then ports, missing-address start and output scan
yarn e2e:timing     # 20 loads of each view in Chrome; exits non-zero above 5000 ms at the 95th percentile
yarn workspace e2e test --watchAll=false --coverage   # the unit tests of the helpers and file checks (no Docker)
```

Reports and timing numbers are written to `packages/e2e/dist/out/`. Trace, video and HAR capture are off so that tokens and headers are never recorded; after each run the logs and the report folder are searched for the database password and for token-shaped text.

### Making the CI result block a merge

The workflow ends with one job, `ci-ok`, that needs every other job and fails unless all of them succeeded. A repository setting cannot be committed as code, so set it once in GitHub: **Settings > Branches > branch protection rule for `main` > Require status checks to pass before merging > add `ci-ok`**. Doing it per job would need a settings change for every new job.

### Screen-reader checklist (done by a person, once)

No pipeline can run a screen reader. With VoiceOver and Chrome (macOS), or NVDA and Firefox (Windows), do each of these and note the result in the pull request:

1. Open the sample, hear the three "Sign in as ..." choices, and sign in as Sam.
2. Open a service, then its Guardrails tab, and read the upgrade plan table (names, current and recommended versions).
3. Propose an upgrade and hear the confirmation.
4. Switch to Priya, open the change, try to approve without a reason (hear the error), then approve with one.
5. Read the audit log and use its filters and paging.

### Browser versions

Chrome is the stable channel installed on the machine or runner and moves on its own; Firefox is the build shipped with the pinned Playwright version (`@playwright/test` 1.65.0, checked on 2026-11-09). Each run prints the versions it used. Raise the pin in a pull request to move Firefox.

### Troubleshooting the compose run

| Symptom                                                           | Cause and fix                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `Docker is not installed` or `Docker Compose v2 is not available` | Install or update Docker; `docker compose version` must work                        |
| `.env.compose is missing but the database volume ... exists`      | Run `yarn compose:reset`, then `yarn compose:up`                                    |
| `GUARDRAILS_SEED is set to another value`                         | Unset it; the compose sample only runs with `20261106`                              |
| `did not become healthy within 180 seconds`                       | Read the printed service logs; a crash shows because nothing restarts by itself     |
| The page shows the sign-in again after a reload                   | By design: the sign-in is held in memory only                                       |
| Port 7007 is already in use                                       | Stop `yarn start:local` or whatever uses it; the compose run needs `127.0.0.1:7007` |
