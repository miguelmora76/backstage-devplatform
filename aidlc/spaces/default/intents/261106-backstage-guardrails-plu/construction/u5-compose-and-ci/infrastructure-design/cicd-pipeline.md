# CI/CD Pipeline — u5-compose-and-ci

Sources: `team-practices.md` (pull requests, CI green before merge, Prettier and ESLint, 85% coverage, nothing deploys automatically, docker compose locally), this unit's `security-design.md` (the compose, image, start script, browser-check and pipeline designs), `nfr-requirements/security-requirements.md` and `tech-stack-decisions.md`, `contract-summary.md` (readiness route, the server address), the existing `.github/workflows/ci.yml`, u4's `cicd-pipeline.md` and `infrastructure-design-questions.md`. There is no `functional-spec.md` for this unit (it adds no behavior). The unit extends the shared workflow, which it does not own, next to the `plugin-*`, `ui-*` and `app-*` jobs of u2 to u4. There is no deployment stage: nothing is pushed, published or deployed.

## Deployment Shape Used by the Pipeline

| Facet | Choice |
|---|---|
| Runner | `ubuntu-latest` (GitHub-hosted), with Docker and Compose v2; Node 24 like the other jobs |
| Packaging | The app image from `packages/backend/Dockerfile`, the u1 server image, `postgres` at an exact tag; built in the job, never pushed |
| Browsers | Google Chrome stable (installed on the runner) and the Firefox build of the pinned Playwright version |
| Secrets | None. `permissions: contents: read`; the database password of the compose job is generated inside the job by the start script |
| Triggers | Pull requests and pushes to `main` (unchanged); no `pull_request_target`; no schedule |

## Build and Test Stages

Jobs run in parallel unless `needs` is shown. A failed job fails the pull request through `ci-ok`.

| Job | New or changed | What it does | Gate |
|---|---|---|---|
| `e2e-unit` | new | Installs, runs the unit tests of `packages/e2e` with coverage: start script logic, `.env.compose` creation, `composeArgs`, percentile, `scanOutputs` (plain file and zip entry), the allow-list check, the compose-file tests (one loopback port, rights, health checks, start order, equal base URLs, the Dockerfile copies the files the start command and settings name) and the workflow tests (read-only token, time limits, no push or login, `ci-ok` covers every job, exemption list). No Docker. 15-minute limit | Any failing test, or line coverage below 85%, fails (NFR2.1, NFR2.3, NFR2.4, NFR5.2, NFR5.4, NFR5.9) |
| `app-image` | new | Builds the app image as `guardrails-app:ci` (not pushed); checks a non-root user, exactly one exposed port, size at most 550 MB (raised from 500 MB; person-approved 2026-11-09), and that the start target exists inside the image (`test -f` of the entry the start command runs). 15-minute limit | Any check fails (NFR1.4, NFR5.3) |
| `compose-e2e` | new; `needs: [app-image]` (only a fail-fast order: it rebuilds the image itself through `compose:up --build`, which fits because the jobs are separate; the size check is in `app-image` only) | 25-minute limit. In order: `yarn compose:reset` then `compose:up`; install Chrome and Firefox; flows, accessibility, keyboard and tree specs; header, token and audit specs; repeatability; timing; the missing-address run; `scanOutputs`; always `compose:down`; upload report and timing numbers (7 days). Each step prints its time | Any spec failing, p95 over 5000 ms, an exit code not as required, or a secret found, fails (NFR1.1 to NFR1.3, NFR3.1 to NFR3.3, NFR4.1, NFR5.6, NFR5.7, NFR5.10 to NFR5.12, NFR7.1, NFR7.2) |
| `ci-ok` | new | `needs` every other job; `if: always()`; fails when any needed job is not `success`; the one status the repository requires. 5-minute limit | NFR2.4, NFR2.5, FR10.1 |
| `lint`, `typecheck` | changed (two added steps, on top of the three edits below) | Add `packages/e2e` lint and typecheck steps; `format` needs no change because Prettier already covers every file | NFR6.1 |
| all existing jobs | changed (3 small edits) | `timeout-minutes: 15`; the two plugin jobs' `postgres:16` becomes the same exact tag as compose; their throw-away database login stays and is the named exemption of the secret test | NFR5.2, NFR5.4, NFR5.9 |

The new package's dependencies are limited by its allow-list file and a check script run in `e2e-unit` (NFR5.8).

## App Image Build Details

| Point | Decision |
|---|---|
| Build command | Inside the image's build stage, which is isolated from the repository's own `dist` folders: `yarn install --frozen-lockfile --ignore-scripts`, `yarn workspace app build`, then the Backstage CLI directly in `packages/backend` (`yarn backstage-cli package build`), not `yarn build` (that script is `tsc` and serves `catalog:write` and `check:settings`; the isolated stage means the CLI build cannot overwrite what other jobs need) |
| Unpack steps (runtime stage) | Copy `skeleton.tar.gz` and unpack it in `/app`, run the production install (`--frozen-lockfile --ignore-scripts`), then copy `bundle.tar.gz` and unpack it in `/app` |
| Entry point | The CLI writes the bundle with its own `package.json` whose entry is the compiled file, so `node packages/backend` starts it; the first real image build confirms this, and `app-image` asserts the entry file exists in the image. Fallback, written down if the entry differs: start `node packages/backend/dist/index.cjs.js` instead and have the `test -f` assert that exact file; the compose-file test reads the entry from the Dockerfile's command, so the two cannot drift |
| Frontend copy | The whole `packages/app/dist` is copied to `/app/node_modules/app/dist` (so the index files stay readable in the image); only its `static` subfolder is also kept as the pristine copy at `/app/app-static-src`, and a tmpfs covers `dist/static` at run time, filled by `cp -R` before the backend starts |
| Native modules | `--ignore-scripts` in both stages like the server image; `better-sqlite3` is not built (the compose run uses PostgreSQL); if the frontend build needs a toolchain, only the build stage gets one |
| Tags | Base image tag in one `ARG` default; the PostgreSQL tag in one place shared by compose and the two plugin jobs |

## Test Automation Integration

| Check | Where it runs | Notes |
|---|---|---|
| Unit tests with 85% coverage for `packages/e2e/src` | `e2e-unit` | Threshold in the package's own test settings, never lowered |
| Real-browser flows, accessibility scan, keyboard walkthrough, accessibility tree | `compose-e2e` in Chrome and Firefox | Trace, video and HAR off; failure screenshots kept |
| Headers, token step, append-only audit | `compose-e2e`, plain HTTP | Valid demo token on the write attempts; counts before and after |
| 20-load timing | `compose-e2e`, Chrome only | `yarn e2e:timing` is the same command locally; there is no Firefox timing run |
| Missing-address start | `compose-e2e` | `docker compose run --no-deps` without `--rm`, then inspected and removed |
| Real screen reader | By hand, once | README checklist; listed as an open item |

## Deployment Strategy, Rollback and Promotion

There is no deployment. The compose run is started and stopped by the person; `compose:down` stops it and keeps the data, `compose:reset` removes the data. A change is "rolled back" by reverting the pull request in git. There is no environment promotion (one environment) and no feature flag.

## Secrets Management

| Secret | Where | Rule |
|---|---|---|
| Database password of the compose run | `.env.compose`, generated, mode 0600, untracked | Never printed, never in an image or a layer, searched for in all outputs (NFR5.2, NFR5.10) |
| CI database login of the two plugin jobs | the workflow file | A named throw-away exemption valid only inside the job |
| Repository secrets | none | The workflow test finds no `secrets.` reference |

## Notes on Earlier Documents

In this unit's NFR Design `traceability.json` the targets of NFR5.10 ("report and traces") and NFR5.12 (`docker compose run --rm`) are superseded by the NFR Design body and this stage's targets: trace capture is off (the zip scan is only a defense) and the missing-address container is run without `--rm`, named, inspected, then removed. That file is left as reviewed. Playwright specs must not be named `*.test.ts`, because the root `test` script (`backstage-cli repo test`) would pick them up; they are `*.spec.ts` under `packages/e2e/specs/`, run only by Playwright.

## What This Pipeline Does Not Prove

| Item | Why | Where it goes |
|---|---|---|
| A screen-reader pass | No pipeline can run one | README checklist; open item for the person (NFR3.4) |
| The required status in the repository | A branch-protection rule is a repository setting | README names it; open item for the person (NFR2.5) |
| A failing pull request showing a failed status | Needs GitHub | Shown once on a throw-away branch in Code Generation if the repository allows, otherwise listed as open |
| Real container behavior under `read_only` and dropped capabilities | Needs a Docker run | First real run in Code Generation; written exceptions if it fails |
| Chrome and Firefox of the day | Chrome moves with the runner | Versions printed in each report (NFR4.2) |
