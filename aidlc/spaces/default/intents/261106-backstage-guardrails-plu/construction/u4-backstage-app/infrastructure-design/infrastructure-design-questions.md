# Infrastructure Design — u4-backstage-app — Questions

This unit is the Backstage app: a frontend bundle and a backend process, with no cloud resource of its own. The compose files, the image build, the real-browser checks and the shared workflow file belong to u5 (compose and CI); minikube files belong to u6. Already fixed by earlier stages, so not asked again: local only with docker compose, nothing deploys automatically, PostgreSQL supplied by the compose override and in-memory SQLite for plain local development, the readiness route as the only health signal, the committed settings with `${GUARDRAILS_SERVER_URL}` and the demo switch off by default, the content-policy setting, the Prettier and ESLint rules, 85% line coverage, and the package allow-list check.

Settled as design choices without asking (written into the design for you to correct):
- Deployment facets: two processes in the sample (the backend serving the built frontend, and the guardrails server from u1); the app image is built by u5 from this unit's build output; one environment (the laptop).
- New workflow jobs for this unit, added to the shared workflow beside the others: `app-unit` (tests with coverage and the 85% gate on the app's own code), `app-startup` (the start-up test with the test backend and stand-in server, no Docker), `app-catalog` (the catalog drift test and the double-run byte check), `app-checks` (settings check, allow-list scripts, lint bans, no host name or port in the source), `app-build` (builds both packages and uploads the output).
- Monitoring is a table with the readiness route, the demo-on warning line and the failed-start exit code; no metrics, alerts, dashboards or SLOs.
- No secret is needed in CI; nothing is published; rollback is reverting the pull request.
- The exact environment variable list (server address, demo switch, app and backend base addresses, backend port, database host, port, name, user and password) is written once in the specification and in the README.

## Q1. [Operations] How should the environment variables be supplied when running without compose?

Why we ask: the app needs `GUARDRAILS_SERVER_URL` and, to sign in, `GUARDRAILS_DEMO_SIGN_IN=true`; Backstage does not read a `.env` file by itself. A plain `yarn start` with a missing variable stops with a message (by design), so the way to set them should be obvious. Recommendation: A, because the same file can be reused by u5's compose override and the README can show one command.

- A. A committed `.env.example` with every variable and safe local values (no password), plus a `yarn start:local` script that loads a copied `.env` and starts both packages; compose uses the same variable names
- B. The variables are only listed in the README and the person exports them by hand
- C. A gitignored `app-config.local.yaml` the person writes, with the variables left for compose only
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Local settings: a committed `.env.example` with every variable and safe local values, plus a `start:local` script that loads a copied `.env`; compose uses the same variable names (Q1: A)
- Design choices set without asking: two processes and one environment, image built by u5; new jobs app-unit (85% gate), app-startup, app-catalog, app-checks and app-build in the shared workflow; monitoring only the readiness route, the demo-on warning and the failed-start exit code; no secret in CI, nothing published, rollback by reverting the pull request; one variable list written in the specification and the README

- Looks correct
- Request changes

[Answer]: Looks correct
