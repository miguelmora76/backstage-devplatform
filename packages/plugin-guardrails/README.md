# plugin-guardrails

The Guardrails frontend plugin for Backstage (new frontend system). It shows,
on a service's catalog page, what the guardrails server and the
`plugin-guardrails-backend` plugin know about the service, and lets people
propose, approve, reject and retry changes with a reason. Every decision and
every refused attempt is in the audit log on the same page.

It calls only the plugin backend (`/api/guardrails`, contract C1) and the
demo sign-in start address of the auth backend (contract C3). It never calls
the guardrails server, and it never decides a rule: it shows what the backend
says is allowed.

## What it adds to the service page

| Where                                 | What                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Overview tab                          | A card with three counts (upgrades available, failed CI runs, open changes) and a link to the tab |
| Tab "Guardrails"                      | Dependency upgrade plan, CI failure triage, open changes, audit log with filters and paging       |
| Tab "Guardrails", `changes/:changeId` | One change, with the reason box and Approve, Reject or Retry                                      |
| Header of the tab                     | The signed-in user and, when the demo sign-in is on, the demo-user switch                         |

The service name used in every call is the catalog entity name. The tab and the
card are `entity-content` and `entity-card` extensions (from
`@backstage/plugin-catalog-react/alpha` in the pinned version).

## Loading it in the app (u4)

```ts
import { guardrailsPlugin } from 'plugin-guardrails';
// add guardrailsPlugin to the features of the app created with the new
// frontend system
```

The host app also needs the backend side: `plugin-guardrails-backend` and its
`authModuleDemoSignIn`, with `guardrails.demoSignIn.enabled` set to `true` only
in the compose override. The plugin reads no setting of its own; both base
addresses come from Backstage's discovery service.

## The demo-user switch and its accepted risk

With the demo sign-in on, anyone who can open the page can become Sam, Priya or
Alex without a password. The plugin keeps the chosen user's token in memory
only; the only value in tab storage is the user id. The switch is shown only
when the backend gives the user list. Replace the provider before any hosted
use.

## Tests

From the repository root (the time zone is pinned by the test script):

```
yarn workspace plugin-guardrails test
yarn workspace plugin-guardrails test --coverage     # 85% line floor, never lowered
yarn workspace plugin-guardrails contract:check      # stand-in vs c1-openapi.yaml, sign-in shape
yarn workspace plugin-guardrails build
yarn workspace plugin-guardrails check:packages      # only allowed packages
yarn workspace plugin-guardrails check:built         # no address in the build, at most 300 KB
```

The tests run in a simulated browser against a stand-in backend
(`src/testing/standIn`) that a contract test keeps in step with
`packages/plugin-guardrails-backend/contract/c1-openapi.yaml`. Checks that need
a real browser (colour contrast, real focus behavior, a screen-reader pass,
Chrome and Firefox walkthroughs, the 20-load timing) are built and run by
u5-compose-and-ci.

## Layout

| Folder           | Content                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `src/api`        | `GuardrailsApi` (the only code that makes calls), `DemoSession` (the credential), failures and C1 types |
| `src/texts`      | The string catalog and `formatTime`                                                                     |
| `src/rules`      | Pure arrangement of backend answers (counts, order, paging, which actions show)                         |
| `src/hooks`      | `useSection`, one load per section                                                                      |
| `src/components` | Shared parts and the sections                                                                           |
| `src/screens`    | The Guardrails view, the change detail and the entity page wrappers                                     |
| `src/testing`    | Stand-in backend and test harness (not part of the build)                                               |
| `src/e2e`        | Security, accessibility, keyboard and performance tests                                                 |
