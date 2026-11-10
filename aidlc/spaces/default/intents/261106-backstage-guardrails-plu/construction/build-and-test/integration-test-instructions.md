# Integration Test Instructions — Guardrails Sample

Sources: the contract summary (C1 to C4), the per-unit `unit-test-instructions.md` files, `packages/e2e` (u5, extended by u6) and the pipeline. Strategy: Standard, so this one file covers the key boundaries and cross-unit interactions.

## Boundaries and Where Each Is Tested

| Boundary | Contract | Test | Where it runs |
|---|---|---|---|
| Guardrails server to plugin backend (MCP over streamable HTTP) | C2 | `contract` job (server tools against `c2-tools.json`); `plugin-contract` job (stand-in server against C2); the plugin's client tests | CI jobs `contract`, `plugin-contract`, `plugin-unit` |
| Plugin backend to plugin UI (REST/JSON) | C1 | `plugin-contract` (route list against `c1-openapi.yaml`); `ui-contract` (stand-in backend against C1) | CI jobs `plugin-contract`, `ui-contract` |
| Plugins to the host app (registration, settings, demo sign-in) | C3 | `app-startup` (the real backend and plugins start together), `app-catalog` (catalog against the seeded service names), `app-checks` (shipped settings) | CI jobs `app-*` |
| Health and start-up settings to the run files | C4 | compose-file and manifest tests in `e2e-unit`; the live runs below | CI jobs `e2e-unit`, `compose-e2e` |
| Rules against a real PostgreSQL (claim, append-only audit, migrations) | u2 BR rules | `plugin-rules` with a PostgreSQL service container | CI job `plugin-rules` |
| The whole sample in real browsers (flows, accessibility, keyboard, headers, token step, append-only audit, repeatability, timing) | FR1 to FR8, NFR1 to NFR7 | `yarn e2e specs` and `yarn e2e:timing` against the compose sample | CI job `compose-e2e`; locally after `yarn compose:up` |
| The same checks on minikube (plus the server-down flow through `kubectl`) | FR9.1 | `E2E_STACK=minikube yarn e2e specs`, `yarn e2e minikube-checks`, `yarn e2e minikube-closed`, `yarn e2e:timing` with `E2E_TIMING_BLOCKING=false` | CI job `minikube-e2e` (not yet run on GitHub); locally after `yarn minikube:up` |

## How to Run

Unit and contract level, no Docker:

```
yarn test --watchAll=false
yarn workspace e2e test --watchAll=false
```

Live level, compose (stop anything holding port 7007 first):

```
yarn compose:reset
yarn compose:up
yarn e2e specs
yarn e2e:timing
yarn e2e checks
yarn compose:down
```

Live level, minikube:

```
yarn compose:down
yarn minikube:up
E2E_STACK=minikube yarn e2e specs
yarn e2e minikube-checks
E2E_TIMING_BLOCKING=false yarn e2e:timing
yarn e2e minikube-closed   # run after minikube:down
yarn minikube:down
```

## Expected Results

- Every selected test passes; a skipped Firefox accessibility scan carries the annotation `known-environment-issue` (Firefox page crash inside the scan; macOS arm64 only).
- `yarn e2e:timing`: the 95th percentile of 20 loads of each view is at most 5000 ms; blocking in the compose job, reported only on minikube.
- Coverage: 85% line coverage per package with its own floor (plugin, UI, app, `packages/e2e`); the project-wide run is checked on the full suite.

## Test Data

The seed is the literal `20261106` in `compose.yaml` and in the ConfigMap/Deployment of `k8s/`; the start scripts refuse another value. After `compose:reset` or a removed namespace both the changes list and the audit log of every seeded service are empty. The three demo users are Sam (service owner), Priya (platform engineer) and Alex (auditor).

## Environment

The browser checks need Chrome and Firefox (`yarn workspace e2e playwright install --with-deps chrome firefox`). The live runs need Docker; the minikube runs also need minikube and kubectl.
