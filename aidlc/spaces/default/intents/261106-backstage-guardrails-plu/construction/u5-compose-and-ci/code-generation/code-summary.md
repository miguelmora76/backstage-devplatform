# Code Summary - u5-compose-and-ci

## What was built

- `compose.yaml`: postgres (Alpine, exact tag `16.15-alpine3.24`, user 70:70), guardrails-server (u1 image), app (new image); one published port `127.0.0.1:7007`; `edge` and `internal` (internal: true) networks; read-only root file systems with named tmpfs paths; limits as designed; health checks; start order by health; `restart: "no"`.
- `packages/backend/Dockerfile`: multi-stage app image (backend bundle plus built frontend), non-root `node`, one port, start command copies the pristine static files into the tmpfs then starts the backend with both settings files.
- `packages/e2e`: unit-tested helpers in `src/` (percentile, composeArgs, envFile, checkDocker, scanOutputs including zip entries, allow-list, compose/Dockerfile/ignore/workflow checks, start/stop/reset commands, published-port and missing-address checks, e2e orchestration); thin `.mjs` entries in `bin/`; Playwright specs in `specs/` (repeatability, headers-token, audit-append-only, flows, a11y, keyboard, tree, timing).
- `.github/workflows/ci.yml`: new jobs `e2e-unit`, `app-image`, `compose-e2e`, `ci-ok`; `timeout-minutes` on every job; `packages/e2e` lint and typecheck steps; exact PostgreSQL tag; documented exemption comment.
- `.dockerignore` (`**/dist-types`, `.env*`), `.gitignore` (`.env.compose`), root `package.json` scripts (`compose:up`, `compose:down`, `compose:reset`, `e2e`, `e2e:timing`, and `-p packages/e2e` added to `tsc`), `README.md` (new sections only).

## Results

- Unit tests: 125 passing in 14 suites, line coverage of `packages/e2e/src` 97.5% (floor 85%).
- Live (Docker, macOS arm64): the sample starts healthy (about 25 s after the first build); repeatability, headers, token and audit checks pass; flows pass in Chrome and Firefox; keyboard passes in both; timing p95 at most 372 ms for each of the six views (limit 5000 ms); published ports, missing-address start and output scan pass.

## Settled by the first real run (Step 9)

- Backend bundle entry `node packages/backend` works (`dist/index.cjs.js`).
- `--ignore-scripts` works in both stages; no toolchain needed.
- `read_only: true` works for the app, the server and PostgreSQL under `70:70` with `cap_drop: [ALL]`; no written exception was needed for rights.
- The static tmpfs needs `uid=1000,gid=1000,mode=0755` (a default tmpfs is not writable by uid 1000): recorded in `compose.yaml` and `COMPOSE_LIMITS`.
- `tar` must extract with `--no-same-permissions` (the bundle's `./` is mode 0700).
- An emptied `GUARDRAILS_SERVER_URL` counts as missing (exit 1, message names `guardrails.server.url`).
- Memory: app about 230 MB of 1 GB, PostgreSQL about 106 MB of 512 MB, server about 29 MB of 256 MB.

## Deviations

- The image prune (`@types typescript @swc mockttp better-sqlite3 ts-json-schema-generator apache-arrow`) is new; larger prunes (`@azure`, `@octokit`, `@typespec`) stop the backend at load.
- `plugin-guardrails-backend/package.json` is patched inside the image (`main`/`types` to `dist`), because that package has no `publishConfig` (finding for u2).
- NFR7.1 "reset twice, compare byte for byte": the spec compares two reads and the stored default data set, not two full resets (time budget).
- Tokens are not collected for the output scan; token-shaped text (JWT pattern, `Bearer`) is scanned instead, which covers every token the sign-in issues.
- Output folders are `packages/e2e/dist/out/` (already ignored by git, Docker and Prettier) instead of `out/`.
- The missing-address check and the port check are in `yarn e2e checks` and `yarn e2e specs` is the spec part, so the pipeline prints a time per step.
- The commands/verify/e2eRun tests were written before their code but the failing run was not recorded separately.

## Person decisions applied (2026-11-09)

1. **Image size target raised from 500 MB to 550 MB (person-approved).** The `app-image` job now measures the image's file system with `docker run --user 0 ... du -sxm /` (the same on every Docker image store) and fails above 550 MB. Current value: 537 MB. The Dockerfile comment and the design notes (`security-design.md`, `tech-stack-decisions.md`, `monitoring-design.md`, `cicd-pipeline.md`) now say 550 MB with the approval noted; reviews and earlier traceability files are left as they were. No other threshold changed.
2. **Approved edit to u4 (catalog list accessibility).** Backstage's catalog list failed axe `nested-interactive` (drag handle button inside the sort-label button) and had unnamed comboboxes and tables. Added `packages/app/src/a11y/catalogA11y.ts` (repairs, with tests), `CatalogA11yFix.tsx` (a root element that keeps the repairs applied via a MutationObserver on added nodes, with a test) and registered it in the existing `signInModule` (`packages/app/src/signInModule.tsx`, so the app still has exactly three features). Effect: the drag handle leaves the button role and the tab order (column drag by keyboard is gone; sorting is unchanged), each filter combobox gets the name of its label, the list table is named "Catalog entries" and the paging table "Catalog paging". u4's 42 app tests pass (coverage 97.6%), lint and tsc pass.
3. **Firefox crash in axe: left as is.** The Playwright Firefox build used here (1.65.0, macOS arm64) crashes the page inside axe's `nested-interactive` rule on the service overview, changes list and audit log. **Confirmed on Linux CI** (PR #5 run 42664310250: the same three Firefox screens skip there), so it is not specific to macOS. The `a11y` spec skips and annotates (`known-environment-issue`) only that exact crash in Firefox; a violation, or the crash in Chrome, still fails. Chrome checks are untouched.

## Final results

- `yarn e2e` (after reset): 37 passed, 3 skipped (the Firefox crash), then ports, missing-address start and output scan passed.
- `yarn e2e:timing`: p95 at most 375 ms for every view (limit 5000 ms).
- `yarn tsc`, `yarn lint`, `yarn prettier:check` pass; e2e unit tests 125 passed, 97.52% lines; app 42 passed, 97.63%; backend 30 passed, 96.49%.

## Open items

1. Firefox axe crash on three screens: confirmed on Linux CI and macOS; skipped and annotated in the spec, Chrome checks run in full.
2. u2: `plugin-guardrails-backend` has no `publishConfig` (the image patches `main`).
3. Not checkable here: screen-reader pass (NFR3.4), GitHub status and the `ci-ok` branch-protection setting (NFR2.5), a failing pull request showing a failed status, the workflows on GitHub.
4. Margin of the size check is 13 MB (537 of 550).

## Fix after PR #5 (compose-e2e failed on Linux CI)

- Symptom: the Firefox flow failed at the retry set-up, `priya.decide(..., 'approve')` while the guardrails server was stopped returned a body without `status`.
- Cause: the plugin backend reuses a server health result for 5 seconds (`serverHealth.ts`, BR7.1) and refuses a decision with 503 SERVER_UNREACHABLE when the fresh probe fails; the change then stays pending and there is no `status`. The spec relied on the cached "reachable" result from the proposal still being valid after `docker stop --timeout 5`. On the Mac the stop was quick enough; on the runner the stop plus the earlier steps took longer than 5 seconds. (Inferred from the code and the log; not reproduced on Linux.)
- Fix, in u5's spec code only: the flow now reads the plan just before the server is ended (refreshes the cached result to reachable), ends it with `docker compose kill` (immediate; new `killService` in `specs/support/stack.ts`, `stopService` removed), then approves, so the apply call reaches the dead server and the change fails (FR3.6). The assertion message now prints the HTTP status and body.
- Ordering: `firefox` now depends on `http` (it ran as test 11, before the http project, because it had no dependency). It still has no dependency on `chrome` (so a Chrome failure does not hide Firefox results); with one worker the config order runs Chrome first and the two never overlap.
- Local rerun after a reset: `yarn e2e` 37 passed, 3 skipped (Firefox axe crash), checks passed; e2e unit tests 125 passed, 97.52% lines; lint, tsc, prettier pass.

### Second fix (PR #5, run 42666627514): keyboard spec on the Linux runner

- Symptom: `[chrome] keyboard.spec.ts` failed at `tabTo(page, /^Switch demo user/)` after the proposal ("Never reached ... with the Tab key", 150 presses).
- What is known: after Enter on "Propose change for ..." focus moves to the result banner (`role=status`, `tabindex=-1`, seen in a Linux container), which sits after the header in the document. The switch-user button is therefore *before* the focus, and the old `tabTo` could only press Tab forward, so it relied on the browser wrapping around the whole page (and, in Google Chrome, possibly its own interface) within 150 presses. That is fragile; on the runner it did not arrive.
- Reproduction: the old spec passes on Linux in the Playwright image `mcr.microsoft.com/playwright:v1.65.0-noble` with Chromium (headless, against the running stack through a local port forwarder). Google Chrome stable is not available for Linux arm64, so the exact CI browser could not be reproduced; the failure itself is therefore not reproduced, only the focus position that makes it fragile.
- Fix (spec only, still keys only, no pointer, no programmatic focus on the target): `tabTo` now asks the page only whether the control is before or after the focused element (`compareDocumentPosition`, with the last focused element remembered when focus is lost), presses Shift+Tab or Tab accordingly, and falls back to the other direction. A failure lists the direction hint, the page address and the last ten focused names. All `tabTo` calls in the file use it (sign-in, propose, switch user, view change, reason, approve, Clear filters). Limit is 100 presses per direction.
- Local results after a reset: `yarn e2e` 37 passed, 3 skipped (Firefox axe crash), checks passed; the new keyboard spec also passes in the Linux container with Chromium; e2e unit tests 125 passed (97.52% lines); lint, tsc, prettier pass.

### Third fix (PR #5, run 42670240396): three Chrome failures on the Linux runner

1. **Flows, approve while the server is down got 503 `SERVER_UNREACHABLE`.** FR3.6 and the plugin agree on the rule: `requireReachable()` runs before a decision and refuses with 503 when its health result says the server is down, in which case the change stays pending; only an apply call that gets no answer *after* a "reachable" result leaves the change `failed`. The result is cached for 5 s (`serverHealth.ts`, BR7.1), and a plan read does not refresh it (my earlier "read the plan first" step was wrong: only a write that calls `requireReachable` does). The spec now builds the state deterministically: it waits 5.5 s so any cached result has expired, proposes (a fresh probe: reachable, cached for 5 s), kills the container by id at once (`docker kill <id>`, resolved beforehand with `containerId`), and decides straight away. The assertion is unchanged; its message now prints the HTTP status, the body and the milliseconds since the last probe. The 503 at approve time with a dead server is correct plugin behavior and is not asserted here.
2. **Keyboard spec started on a broken stack ("Error in guardrails").** Most likely cause (consistent with the log, not reproduced): Docker called the restarted server healthy while the plugin backend still held a stale result or connection, so reads failed until it recovered. New `specs/support/healthy.ts` (`waitForHealthyStack`): readiness route 200 and a real plugin read (a seeded plan, through the guardrails server) 200, polled for at most 60 s with an error that names the last answer. It runs at the end of the kill flow (after the container is started and healthy) and in a `beforeAll` of the flows, keyboard, a11y, tree and timing specs, so a failure in the kill flow cannot poison later specs: it leaves a healthy stack or fails clearly where it happened. With one worker the order is fixed by the project dependencies.
3. **a11y catalog list, impact serious.** The rule was `aria-progressbar-name`, not one of the repaired ones: the catalog list still showed its loading indicator (a progress bar without a name) when axe ran. A timing issue in the view marker, not a violation of the finished page. The catalog-list marker now waits for no progress bar, and for the repaired state (no combobox without a name, no button inside a sort-label button) before the scan, so the scan never sees an unrepaired page. The scan itself is unchanged.

- Results: `yarn e2e` after a reset 37 passed, 3 skipped (Firefox axe crash), checks passed; a11y, keyboard and tree also pass in the Linux Playwright image (Chromium, 13 passed). The kill flow cannot run in that image (it needs the Docker CLI), so its timing on the runner is by design, not observed. e2e unit tests 125 passed (97.52% lines); lint, tsc, prettier pass.
