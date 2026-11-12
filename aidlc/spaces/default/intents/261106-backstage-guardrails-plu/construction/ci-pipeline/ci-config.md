# CI Pipeline Configuration

## Sources

- Existing workflow `.github/workflows/ci.yml`, built by u1 to u6 (read 2026-11-11).
- `ci-pipeline-questions.md`: Q1 (images) answered B and then replaced by Q3 = A (nothing is published); Q2 = A (no WebKit job); summary confirmed `Looks correct`.
- Build and Test: `build-and-test-summary.md` and `test-results.md` (the build-test-results document: exit codes, counts and coverage of the 2026-11-11 run; evidence BP: branch protection; PR #7).
- Code summaries: the `code-summary.md` of each Unit u1 to u6 under `construction/*/code-generation/`, which name the packages, commands and jobs each Unit added to the workflow.
- Team practice (`team.md`): GitHub pull requests into `main`, Prettier and ESLint enforced in CI, nothing deploys automatically.

## Decision

CI already exists and is adequate, so this stage documents it and adds no workflow change. Nothing in `.github/workflows/ci.yml` is edited by this stage.

| Item | Value |
|---|---|
| CI tool | GitHub Actions, one workflow `CI` in `.github/workflows/ci.yml` |
| Triggers | every pull request; every push to `main` |
| Branch strategy | short-lived feature branches, merged into `main` by pull request (team practice) |
| Token rights | top-level `permissions: contents: read`, no job-level widening, no secret, no `pull_request_target` (u5 NFR5.9) |
| Concurrency | one run per ref, an older run is cancelled |
| Artifact repository | none. The `image` and `app-image` jobs build the images for checking only; nothing is published (Q3 = A; u5 NFR2.17 "nothing deployed") |
| Deploy | none, by team practice. Hosted deploys remain possible later, because nothing in the workflow blocks adding them |
| Browsers in the pipeline | Chromium and Firefox through Playwright. No Safari or WebKit job (Q2 = A) |
| Node | 24 (`NODE_VERSION`) |

## Jobs

All jobs have a `timeout-minutes` limit: 15 for most, 25 for `compose-e2e`, 35 for `minikube-e2e`, 5 for `ci-ok`.

| Group | Jobs |
|---|---|
| Style and types | `format`, `lint`, `typecheck` |
| Guardrails server (u1) | `test`, `repeatability`, `contract`, `image` |
| Plugin backend (u2) | `plugin-unit`, `plugin-rules`, `plugin-coverage`, `plugin-contract`, `plugin-build` |
| Plugin UI (u3) | `ui-unit`, `ui-coverage`, `ui-contract`, `ui-build`, `ui-checks` |
| App (u4) | `app-unit`, `app-coverage`, `app-startup`, `app-catalog`, `app-checks`, `app-build`, `app-image` |
| Compose and end to end (u5) | `e2e-unit`, `compose-e2e` |
| Minikube (u6) | `minikube-e2e` |
| Single required status | `ci-ok` |

## The merge gate

`ci-ok` lists every other job in `needs`, runs even when one of them fails (`if: always()`), and fails itself when any needed job did not succeed. Branch protection on `main` (turned on 2026-11-11, evidence BP in the Build and Test summary) requires the `ci-ok` status, applies to administrators, and blocks force-pushes and deletion. Pull request reviews are not required (solo project).

Demonstration: throwaway PR #7 added an unformatted file; `format` failed, `ci-ok` did not report a pass, and the merge was refused with the PR in state `BLOCKED`. The PR was closed without merging.

## Known gaps

- `ci-ok` is the only required status and the branch rule has no required PR review; a second maintainer would need that added.
- The pipeline never opens the app in Safari; the Safari fix is covered by the `csp-no-upgrade` settings rule only.
- Two earlier flakes (`plugin-rules` timing, `compose-e2e` accessibility scan on a loading spinner) passed on re-run and are not known to be fixed.
