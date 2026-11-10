# Build Instructions — Guardrails Sample (u1 to u6)

Sources: the per-unit `code-summary.md` and `unit-test-instructions.md` of u1 to u6 under `construction/*/code-generation/`, the root `package.json`, `compose.yaml`, `k8s/`, `.github/workflows/ci.yml` and the README. The build is the same on a laptop and in the pipeline.

## Prerequisites

| Need | Version | Used by |
|---|---|---|
| Node.js | 24 (the pipeline uses 24; `engines` allows 22 or later) | everything |
| Yarn | 1.22 (classic) | everything |
| Docker with Compose v2 | any recent | `yarn compose:*` and the app image |
| minikube and kubectl | optional; the pipeline pins minikube v1.39.0 and kubectl v1.37.2 | `yarn minikube:*` only |
| Chrome and Firefox | stable, installed by `yarn workspace e2e playwright install` | the live browser checks |

## Install

```
yarn install --frozen-lockfile
```

## Environment Setup

| Item | Where it comes from |
|---|---|
| `.env` (addresses for `yarn start:local`) | copy `.env.example`; never committed |
| `.env.compose` (generated database password for the compose run) | created by `yarn compose:up` on the first run; mode 0600; never committed, never printed |
| Kubernetes Secret `guardrails-db` | created by `yarn minikube:up` on the first run through standard input; never in a file |
| Demo sign-in | on only in the compose and minikube runs (`GUARDRAILS_DEMO_SIGN_IN=true`); off in the shipped settings |

## Build Commands

| What | Command |
|---|---|
| Type check the whole workspace | `yarn tsc` |
| Build the plugins and the app (also run by the pipeline per package) | `yarn workspace <name> build` for `plugin-guardrails-backend`, `plugin-guardrails`, `app`, `backend`, `guardrails-server`, `e2e` |
| Build the app image (not pushed) | `docker build -f packages/backend/Dockerfile -t guardrails-app:ci .` |
| Build the server image (not pushed) | `docker build -f packages/guardrails-server/Dockerfile -t guardrails-server:ci .` |

## Build Verification

1. `yarn tsc` exits 0.
2. `yarn lint` and `yarn prettier:check` exit 0.
3. The app image: a non-root user, exactly one exposed port, at most 550 MB of file system (the `app-image` job runs `du -sxm /` in the image), and `packages/backend/dist/index.cjs.js` exists inside it.
4. The one-command checks: `yarn compose:up` brings up three healthy containers; `yarn minikube:up` brings up three ready pods and a port-forward on `127.0.0.1:7007`. Only one of the two can hold port 7007 at a time (`yarn compose:down` first).

## The Verification Command (Unit and Build and Test checkpoints)

```
yarn tsc && yarn lint && yarn prettier:check && yarn test --watchAll=false --coverage --testPathIgnorePatterns packages/guardrails-server/src/performance.test.ts && yarn workspace guardrails-server test --watchAll=false src/performance.test.ts
```

It runs without Docker, a cluster or a browser.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `yarn minikube:up` stops at the port-forward with "port already in use" | The compose sample holds 7007: `yarn compose:down` |
| `yarn minikube:up` refuses with a context message | The current kubectl context is not `minikube`; the script only acts on the local minikube cluster |
| The first `minikube:up` is slow (about 14 minutes cold) | The Backstage frontend builds inside the node; later runs use cached layers (6 s rollout) |
| The image build runs out of memory in the node | The script falls back to building with the host's Docker and loading the image |
| `wait-postgres` init container never finishes | Fixed in `k8s/app.yaml` (`pg_isready -U postgres`); if it returns, read `kubectl logs` of the init container |
| Firefox crashes inside the accessibility scan of three screens on macOS arm64 | Known environment issue of the pinned Playwright Firefox; the spec skips only that exact crash and annotates it. Chrome runs all six screens |
| `Cannot find module` on a `yarn e2e` entry | The entry builds the package first; run `yarn workspace e2e build` to see the compile error |
