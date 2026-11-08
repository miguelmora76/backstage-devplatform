# plugin-guardrails-backend

The backend of the guardrails sample: a Backstage backend plugin (plugin id
`guardrails`, routes under `/api/guardrails`) that relays the upgrade plan and
the failed CI runs from the guardrails server, runs the propose, approve,
reject and retry flow with an atomic claim, and keeps an append-only audit log.
All data is invented; nothing here is a real system.

What it owns: the demo users (Sam, Priya, Alex), the `Change` and `AuditEntry`
records in PostgreSQL, the sign-in check on every request, and the `demo`
sign-in provider.

## Settings

All settings are Backstage app-config keys (contract C3). Nothing is written in
code; the server address has no default.

| Key                                | Default | Meaning                                                                                                                  |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `guardrails.server.url`            | none    | Address of the guardrails server (required, `http` or `https`). The MCP endpoint is `/mcp`, the health route `/healthz`. |
| `guardrails.server.readTimeoutMs`  | `3000`  | Read timeout for the plan and failed-run tools.                                                                          |
| `guardrails.server.writeTimeoutMs` | `10000` | Write timeout. Must stay below `30000`, the time after which a stuck claim is released.                                  |
| `guardrails.demoSignIn.enabled`    | `false` | Turns on the passwordless `demo` sign-in and the open list of demo users. See the accepted risk below.                   |

The database login comes from Backstage's own database settings
(`backend.database`); use PostgreSQL. The plugin runs its migrations when the
backend starts and reports ready after they finish.

## Adding it to a Backstage backend

```ts
backend.add(import('plugin-guardrails-backend'));
// The demo sign-in provider, a module of the auth plugin:
import { authModuleDemoSignIn } from 'plugin-guardrails-backend';
backend.add(authModuleDemoSignIn);
```

u4-backstage-app does this wiring and keeps `guardrails.demoSignIn.enabled`
false in the shipped config; u5-compose-and-ci turns it on in the compose
override and runs the PostgreSQL service with a named volume.

## The demo sign-in and its accepted risk

With `guardrails.demoSignIn.enabled: true`, anyone who can open the page can
sign in as any of the three demo users, including the platform engineer,
without a password. That is the purpose of the demo. The backend still enforces
roles, the no-self-approval rule and the audit log. The risk is contained by
the switch: it is off by default, the provider and the open user list
(`GET /api/guardrails/demo-users`) are not registered when it is off, and the
backend writes a warning line at start-up when it is on. Choosing a user is
`GET /api/auth/demo/start?userId=sam` (or `priya`, `alex`), which answers with
the Backstage identity `user:default/<userId>`.

Before any hosted use, replace the demo provider with a real Backstage sign-in
provider. The backend already reads the actor only from the sign-in identity,
so only the provider changes.

## Routes

The interface is contract C1, in [`contract/c1-openapi.yaml`](contract/c1-openapi.yaml).
Every route except the user list needs a sign-in identity that names one of the
three demo users; the actor and role are never read from the body, query or
headers.

- `GET /me`, `GET /demo-users` (open, only while the demo sign-in is on)
- `GET /services/{service}/plan`, `GET /services/{service}/ci-runs`
- `GET` and `POST /services/{service}/changes`, `GET /changes/{changeId}`
- `POST /changes/{changeId}/approve`, `/reject`, `/retry`
- `GET /services/{service}/audit` (read only, there is no write, edit or delete)

## How a decision works

1. Identity, then input shape (`400 INVALID_INPUT`), then existence, then the
   reason (`400 EMPTY_REASON`), then the role checks (`403`, recorded as
   refused), then the server health probe (`503`, nothing written).
2. A missing audit entry of the change's latest decision is rebuilt.
3. One atomic conditional update claims the change (`pending` or, for a retry,
   `failed`, to `deciding`); exactly one caller wins.
4. Approve and retry call the guardrails server (10 second limit, never
   repeated by the backend); reject calls nothing.
5. The final status and the audit entry are written in one transaction that
   needs the caller's own claim token.
6. A claim older than 30 seconds is released on the next read or decision: an
   approve or retry becomes `failed` with the message `Interrupted`, a reject
   goes back to `pending`, each with its audit entry.

## Tests

Run from the project root. The fast tests use Knex on in-memory SQLite and a
stand-in guardrails server built from the C2 spec file kept by
`guardrails-server`; the PostgreSQL cases skip when no connection string is set.

```
yarn workspace plugin-guardrails-backend test --watchAll=false
```

The rule tests on a real PostgreSQL (claim, release, repair, append-only
trigger, restart, concurrency, 100,000 entries, timings) need docker for a
throw-away database:

```
docker compose -f packages/plugin-guardrails-backend/compose.test.yaml up -d --wait
BACKSTAGE_TEST_DATABASE_POSTGRES16_CONNECTION_STRING=postgresql://postgres:postgres@localhost:55432/postgres \
  yarn workspace plugin-guardrails-backend test --watchAll=false
docker compose -f packages/plugin-guardrails-backend/compose.test.yaml down -v
```

Coverage (a command of its own, since its threshold can fail the exit code; at
least 85% line coverage, never lowered):

```
yarn workspace plugin-guardrails-backend test --watchAll=false --coverage
```

The contract check compares the stand-in server and the client with the C2
spec and the route list and code lists with the C1 file:

```
yarn workspace plugin-guardrails-backend contract:check
```

CI runs these as the `plugin-*` jobs of `.github/workflows/ci.yml` (unit tests,
rule tests on a PostgreSQL service container, coverage, contract check, build),
after the shared format, lint and type check jobs.

## Layout

- `src/plugin.ts`, `src/index.ts`: the plugin and its exports.
- `src/http/`: routes, identity guard, input schemas, request logger, error handler.
- `src/workflow/`: the change workflow and recovery.
- `src/rules/allowedActions.ts`: the one place the role and state rules live.
- `src/store/`, `src/database/`, `migrations/`: the stores, table names and migrations.
- `src/server/`: the MCP client for the guardrails server and the health probe.
- `src/auth/demoSignIn.ts`: the `demo` sign-in provider.
- `src/testing/`: test support (stand-in server, fake clock, harness); not built.
