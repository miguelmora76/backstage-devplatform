# Code Generation Plan — u5-compose-and-ci

## Summary

- Builds: the one-command docker compose run (compose file, app image build file, start script), the `packages/e2e` package with its unit-tested helpers and real-browser, header, token and timing checks, and the new and edited jobs of the GitHub Actions workflow, with README sections for all of it
- Touches: `compose.yaml`, `packages/backend/Dockerfile`, `packages/e2e/`, `.github/workflows/ci.yml`, `.dockerignore`, `.gitignore`, root `package.json` (scripts only), `README.md` (new sections only)
- Tests: about 60 unit tests (Jest, test first, no Docker) for the helpers, the compose file, the image build file and the workflow; about 30 Playwright checks against the running sample in Chrome and Firefox; line coverage at least 85% on `packages/e2e/src`

## Sources

`security-design.md` and its `traceability.json` (the compose, image, start script, browser-check and pipeline designs), `infrastructure-specification.md`, `cicd-pipeline.md` and `monitoring-design.md` of this unit, `security-requirements.md` (NFR5.1 to NFR5.12) and `tech-stack-decisions.md` (NFR1.1 to NFR7.2), `contract-summary.md` (C3, C4), `unit-of-work.md` (U5) and `requirements.md` (FR8.1, FR10.1, NFR1 to NFR7). Stories: US6.2 and US6.4. u5 has no functional design (it adds no behavior).

## Testing Contract

```json
{
  "version": 1,
  "methodology": "tdd",
  "source": "team",
  "ordering": "For each layer, write a failing test before writing the code that makes it pass.",
  "scope": "mvp",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: tdd\n- **Ordering**: For each layer, write a failing test before writing the code that makes it pass.\n- **Methodology evidence**: The team chose test-first (test-driven) development in the interview (Q3: B); no existing code or history exists to suggest otherwise.\n- Coverage: at least 85% line coverage on the plugin code, and CI runs the tests before merge and must be green (Q4).\n- Build and Test may not weaken the coverage floor to pass."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Meet an 80% line-coverage floor.",
      "Run the selected tests in CI before merge."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "tdd",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - Red: write the failing tests and record the failing command output.",
      "Data model / database behavior - Green: implement only enough behavior to pass.",
      "Data model / database behavior - Refactor: improve the implementation while tests stay green.",
      "Repository / data access - Red: write the failing tests and record the failing command output.",
      "Repository / data access - Green: implement only enough behavior to pass.",
      "Repository / data access - Refactor: improve the implementation while tests stay green.",
      "Business logic - Red: write the failing tests and record the failing command output.",
      "Business logic - Green: implement only enough behavior to pass.",
      "Business logic - Refactor: improve the implementation while tests stay green.",
      "API / endpoint - Red: write the failing tests and record the failing command output.",
      "API / endpoint - Green: implement only enough behavior to pass.",
      "API / endpoint - Refactor: improve the implementation while tests stay green.",
      "Frontend behavior - Red: write the failing tests and record the failing command output.",
      "Frontend behavior - Green: implement only enough behavior to pass.",
      "Frontend behavior - Refactor: improve the implementation while tests stay green.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:b4a8500ee06ca516328b6af1aaf731b1f118b83b754e86211c0928e7e4bd042e",
  "contract_sha256": "sha256:e296bbb8657fda2574bff860c37db41f575891b05caa066b632cf57f0a3659da"
}
```

## How the Contract's Layers Apply to This Unit

u5 has no database model, repository, endpoint or screen of its own. The contract's layers map as follows; a layer that does not exist here is omitted, as the stage allows: the "business logic" layer is the package's TypeScript helpers; the "configuration" layer (compose file, image build file, workflow, ignore files) is tested as data by unit tests that read the files; the "API / endpoint" and "frontend behavior" layers are the live checks against the running sample (headers, token, audit, flows, accessibility, timing). Every one of them is written before the file or behavior it checks.

## Steps

Stories: US6.2 (one command brings up the sample), US6.4 (the pipeline shows a failed check as a failed status). Requirements: FR8.1, FR10.1; IDs are those of `security-requirements.md` and `tech-stack-decisions.md`.

- [x] Step 1: Project structure. Create `packages/e2e` (`package.json` with a pinned Playwright and axe dependency chosen from the registry that day, `tsconfig.json`, `.eslintrc.js` with Backstage's settings, `allowed-packages.txt`, folders `src/`, `specs/`, `bin/`), and the root scripts `compose:up`, `compose:down`, `compose:reset`, `e2e`, `e2e:timing`. No behavior yet. (NFR5.8, NFR6.1, NFR2.1)
- [x] Step 2: Test runner. Bootstrap Jest through `backstage-cli package test` for `packages/e2e` with the 85% line threshold in the package settings and the exclusions named in the requirements (`bin/`, `specs/`); record the exact command in `unit-test-instructions.md`; run it with one trivial real test to prove it runs. (NFR2.1)
- [x] Step 3: Helpers, Red. Write failing unit tests for: `percentile` (nearest rank, 19th of 20, equal values, wrong sample count), `composeArgs` (project name and env file on every call), `ensureEnvFile` (creates once with a random password and mode 0600, never overwrites, never prints, refuses when the volume exists without the file), `refuseOtherSeed`, `checkDocker`, `scanOutputs` (password, token, token-shaped text, plain file and zip entry, clean folder), the allow-list check. Record the failing output. (NFR1.1, NFR2.2, NFR5.2, NFR5.10, NFR5.8, NFR7.1)
- [x] Step 4: Helpers, Green. Implement `src/` modules until those tests pass, nothing more.
- [x] Step 5: Helpers, Refactor while green; run lint and typecheck for the package.
- [x] Step 6: File checks, Red. Write failing unit tests that read the files that do not exist yet or are not yet edited: compose-file tests (one loopback port, rights, health checks, start order, equal base URLs, limits and tmpfs sizes as written, seed literal, no secret), Dockerfile tests (base `ARG`, user, one port, copied files resolve for the start command and settings, entry), `.dockerignore` and `.gitignore` tests, workflow tests (read-only token, time limits on every job, no `pull_request_target`, no push or login, no `secrets.`, `ci-ok` covers every job, exemption list, exact PostgreSQL tag). Record the failing output. (NFR2.3, NFR2.4, NFR5.1 to NFR5.5, NFR5.9, NFR1.3)
- [x] Step 7: File checks, Green. Write `compose.yaml`, `packages/backend/Dockerfile`, the `.dockerignore` and `.gitignore` additions, and the workflow edits (time limits, exact PostgreSQL tag, exemption comment) until those tests pass.
- [x] Step 8: Entries. Thin `.mjs` files in `packages/e2e/bin/` for `compose:up`, `compose:down`, `compose:reset` and the e2e commands, each a few lines calling a module in `src/` (tested there).
- [x] Step 9: First real run. Build the images and start the sample with `yarn compose:up`; settle what the design left to a real run (backend bundle entry, `--ignore-scripts`, read-only app and database, the static-directory tmpfs copy, PostgreSQL under `70:70`, memory limits). Any written exception or revised number is recorded in the compose file, the design notes and `code-summary.md`; the compose-file tests are updated in the same step so they stay equal to what is written.
- [x] Step 10: Live checks, Red. Write the Playwright specs and plain-HTTP specs before they can pass against anything unverified: `headers-token`, `audit-append-only`, `repeatability`, `flows`, `a11y`, `keyboard`, `tree`, `timing`, and the missing-address and output-scan steps. Run them and record which fail first. (NFR1.1, NFR3.1 to NFR3.3, NFR4.1, NFR5.6, NFR5.7, NFR5.10 to NFR5.12, NFR7.1, NFR7.2)
- [x] Step 11: Live checks, Green. Fix what the failures show (in u5's files only; a finding in an earlier unit is reported, not patched here) until all pass in Chrome and Firefox, and the timing check is under 5 seconds at the 95th percentile.
- [x] Step 12: Pipeline jobs. Add `e2e-unit`, `app-image`, `compose-e2e` and `ci-ok` to `.github/workflows/ci.yml`, the `packages/e2e` lint and typecheck steps, and make the workflow tests from Step 6 pass. Run the commands of each job locally one by one (the workflow itself runs only on GitHub). (NFR2.16, NFR2.4, NFR5.9, NFR6.1)
- [x] Step 13: Documentation. Extend the root `README.md` with new sections only: the one-command run, stopping and resetting, the demo sign-in risk, the repository setting that makes `ci-ok` required, the screen-reader checklist, the browser versions and pin date, and troubleshooting. Existing text is not rewritten. (FR8.1, NFR2.5, NFR3.4, NFR4.2, NFR5.5)
- [x] Step 14: Verification and records. Run the whole repository verification (`yarn tsc`, `yarn lint`, `yarn prettier:check`, the test commands including the separate performance test, and coverage), then write `code-summary.md`, `traceability.json` and `source-manifest.json`; list what could not be checked (screen reader, GitHub status, branch protection) as open items.

## Files This Plan Creates or Changes

| Path | Action |
|---|---|
| `compose.yaml` | new |
| `packages/backend/Dockerfile` | new |
| `packages/e2e/**` | new (`src/`, `specs/`, `bin/`, config, allow-list) |
| `.github/workflows/ci.yml` | extend (4 jobs, 2 added steps, 3 edits) |
| `.dockerignore`, `.gitignore` | extend (one entry each) |
| `package.json` (root) | scripts only |
| `README.md` | new sections only; existing text unchanged |
| `yarn.lock` | updated by the install of the new package |

No existing source of u1 to u4 is edited. `README.md`, `.env.example` and the settings files already exist and are the person's or other units': the README gains new sections only, and the other two are not touched.

## Quality Targets Carried Over

- Line coverage of `packages/e2e/src` at least 85%; earlier floors stay; no threshold is lowered.
- 95th percentile of 20 loads of each view at most 5000 ms in Chrome.
- WCAG 2.1 AA scan with no violation on every screen in Chrome and Firefox.
- App image at most 500 MB; compose start healthy within 180 seconds.

## Risks and What a Real Run Settles (Step 9)

Backend bundle entry; install with `--ignore-scripts` for the frontend build; `read_only` for the app and PostgreSQL; memory limits; whether an emptied `GUARDRAILS_SERVER_URL` counts as missing. Each has a written fallback in the design.
