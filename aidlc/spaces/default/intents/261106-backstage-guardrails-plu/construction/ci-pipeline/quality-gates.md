# Quality Gates

## Sources

- `.github/workflows/ci.yml`; the Units' `code-summary.md` files; `build-and-test-summary.md` and `test-results.md` of Build and Test; `team.md` and `project.md` of the active memory (85% line coverage, Prettier and ESLint enforced in CI, tests run before merge).

## Gates that block a merge into `main`

A pull request merges only when `ci-ok` passes, and `ci-ok` passes only when every job below succeeded.

| Gate | Job(s) | Fails when |
|---|---|---|
| Formatting | `format` | `prettier --check` finds any difference |
| Lint | `lint` | ESLint reports an error in any package |
| Types | `typecheck` | `tsc` reports an error |
| Unit and contract tests | `test`, `plugin-unit`, `plugin-contract`, `ui-unit`, `ui-contract`, `app-unit`, `e2e-unit` | any test fails |
| Coverage floor, 85% lines (team and project rule) | `test`, `plugin-coverage`, `ui-coverage`, `app-coverage`, `e2e-unit` | line coverage of that package falls below 85% |
| Database and rules | `plugin-rules` | any rule or PostgreSQL test fails |
| Repeatability | `repeatability` | the same seed does not give the same bytes |
| Start-up, catalog and shipped settings | `app-startup`, `app-catalog`, `app-checks` | the app does not start with real parts, the catalog drifts from the data, or a shipped setting breaks a rule (including `csp-no-upgrade`) |
| Builds and images | `plugin-build`, `ui-build`, `app-build`, `image`, `app-image`, `ui-checks` | a build, an image check or the package allow-list fails |
| Real-browser end to end on compose | `compose-e2e` | any spec fails in Chromium or Firefox, including accessibility, keyboard, header, token, audit and the p95 ≤ 5 s timing step |
| Real-browser end to end on minikube | `minikube-e2e` | any spec or cluster check fails |
| The summary gate | `ci-ok` | any job above did not succeed |

## Do the gates enforce what Build and Test ran?

Yes. Every command in Build and Test's verification (`tsc`, `lint`, `prettier:check`, the full test run with coverage, and the server benchmark in `test`) has a job above. The Build and Test coverage floors and thresholds were not weakened to pass.

## Not gated

- Safari or WebKit rendering (Q2 = A).
- The manual screen-reader pass, which is a person's check (recorded in Build and Test, evidence SR).
- Anything after merge: there is no deploy and no image publishing.
