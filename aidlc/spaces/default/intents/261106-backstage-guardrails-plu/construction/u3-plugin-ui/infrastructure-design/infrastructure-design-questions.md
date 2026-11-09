# Infrastructure Design — u3-plugin-ui — Questions

This unit is browser code inside the Backstage app: no container, port, database or cloud resource of its own, and no metrics, alerts or dashboards (the plugin logs nothing, security control S2). Already fixed by earlier stages, so not asked again: the plugin is a package of the same workspace built into the app by u4 (NFR2.12), nothing deploys automatically, Prettier and ESLint with Backstage settings, 85% line coverage, the real-browser checks run by u5, the grep and size checks of the NFR Design, and one shared GitHub Actions workflow.

Settled as design choices without asking (written into the design for you to correct):
- New workflow jobs for this package, parallel to the u2 ones: `ui-unit` (tests with the time zone and clock pinned), `ui-coverage` (85% gate), `ui-contract` (stand-in against `c1-openapi.yaml`), `ui-checks` (address grep, 300 KB gzip size, lint rule for raw-HTML insertion), `ui-build`.
- The plugin's tests run in a simulated browser (jsdom) on the same Node release as the other jobs; no browser is installed in this unit's jobs.
- The pipeline needs no secret and publishes nothing; rollback is reverting the pull request.
- Monitoring is "none" in a table, with the reason; the app's own error boundary and the browser console are all that exist.

## Q1. [CI] How should the "only the agreed packages are added" rule (NFR5.12) be enforced?

Why we ask: the rule says the lock file may gain only the packages named in the tech stack decisions. It can be a failing check or a reviewer's job. Recommendation: A, because a check cannot be forgotten and is cheap to write.

- A. A small script in CI compares the lock-file change with an allow-list file kept beside the plugin, and fails the job on any other new package (the list is edited in the same pull request when a package is added on purpose)
- B. No script; the pull request reviewer checks the lock-file diff by eye
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- The package rule (NFR5.12) is enforced by a CI script that compares the lock-file change with an allow-list kept beside the plugin and fails on any other new package (Q1: A)
- Design choices set without asking: new jobs ui-unit, ui-coverage (85%), ui-contract, ui-checks (address grep, 300 KB gzip size, raw-HTML lint) and ui-build beside the u2 jobs; tests in a simulated browser with time zone and clock pinned on the shared Node release; no secret, nothing published, rollback by reverting the pull request; no monitoring stack, only the app's error boundary and browser console

- Looks correct
- Request changes

[Answer]: Looks correct
