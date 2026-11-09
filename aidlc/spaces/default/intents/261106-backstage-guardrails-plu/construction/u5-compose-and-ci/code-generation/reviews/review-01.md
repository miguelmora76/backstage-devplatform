## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-09T17:03:54Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | packages/app/src/a11y/catalogA11y.ts > fixCatalogAccessibility (table and combobox loops); packages/app/src/a11y/CatalogA11yFix.tsx > run() | The repair is described as a catalog-list fix, but it runs on `document.body` for every page. Any `table` without a name anywhere in the app is labelled "Catalog entries" (with a `thead`) or "Catalog paging" (without), and any `th` nested button or unnamed combobox is rewritten on every screen. On the guardrails service overview, changes list, change detail and audit log this can give a wrong accessible name, and it can hide a real axe finding the e2e scan was meant to catch. | Scope the repairs to the catalog list route or container (for example only when the catalog page root is present), or give the labels from the nearest heading. Add a unit test showing a table outside the catalog stays untouched. | New |
| R-02 | Minor | packages/e2e/specs/a11y.spec.ts > catch block (Firefox "Page crashed") ; code-summary.md "Final results" | NFR3.1 requires WCAG 2.1 AA scans in Chrome and Firefox for all six screens. Three Firefox scans are skipped (37 passed, 3 skipped), unverified on Linux CI. The skip is correctly limited to Firefox and the exact "Page crashed" text, and the person accepted it. But CI will report green with that coverage hole if the crash also happens there. | Keep the Open item visible in the README or PR description. Re-run on Linux CI and drop the skip if the crash does not happen there. | New |
| R-03 | Minor | packages/app/src/a11y/catalogA11y.ts > drag handle repair | The sortable column drag handle leaves the button role and tab order, so keyboard column reordering is gone. The summary records this, but a keyboard-operable feature was removed to pass the scan. | Note the removed feature in the u4 documentation or README, and revisit if Backstage fixes the nested button upstream. | New |
| R-04 | Minor | code-summary.md > Deviations; packages/e2e/specs/repeatability.spec.ts | NFR7.1 "reset twice and compare byte for byte" is checked by comparing two reads plus the stored default data set, not two full resets. The summary says so openly. The 13 MB margin on the 550 MB image limit is also thin. | Add a second-reset comparison to the optional or nightly path. Watch the 537 of 550 MB margin as dependencies change. | New |
| R-05 | Minor | packages/backend/Dockerfile > patch of plugin-guardrails-backend/package.json; prune list | The image rewrites `main` and `types` of u2's package and deletes packages by name (`@types`, `typescript`, `@swc`, `mockttp`, `better-sqlite3`, ...). These are fragile against dependency updates. They are documented as deviations and are guarded by the compose run. | Fix the missing `publishConfig` in u2 so the patch can go, and keep the compose-e2e job as the guard for the prune. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `yarn workspace e2e test --watchAll=false --coverage` | 14 suites, 125 tests passed. Lines 97.52% (513/526); branches 90.48% | Meets the 85% line floor (also set as `coverageThreshold.lines: 85` in packages/e2e/package.json). The floor was not lowered. |
| `yarn tsc` | Passed; includes `tsc -p packages/e2e` | OK |
| `yarn lint` | Passed; 55 files checked in packages/e2e | OK |
| `yarn prettier:check` | "All matched files use Prettier code style!" | OK |
| Live checks (`yarn e2e`, `yarn e2e:timing`) | Not run: the stack is not up | Results in code-summary.md (37 passed, 3 skipped; p95 at most 375 ms against the 5000 ms limit) are taken as unverified by this review. |

Targets and secrets checked against the claimed source:
- `compose.yaml` and the Dockerfile hold no password. The values come from `${POSTGRES_PASSWORD}` and a generated, git-ignored `.env.compose`. The only literal is the fixed demo seed `GUARDRAILS_SEED`.
- There is one published port on 127.0.0.1, `internal: true` on the data network, and the 180 s `--wait-timeout` is kept.
- The workflow keeps `permissions: contents: read` and triggers only on `pull_request` and `push` to main. There is no `pull_request_target`. The new jobs have timeouts, and `ci-ok` lists all 25 other jobs.
- The 550 MB image limit is person-approved and applied consistently (CI check and Dockerfile comment).
- `README.md` changes are additions only (the diff has no removed lines).
- Every changed workspace path is listed in source-manifest.json. The u4 edit is limited to `signInModule.tsx` (one added blueprint and one import) plus the new `a11y/` folder.
- The two PostgreSQL service images in the earlier plugin jobs are pinned to the exact tag, with a documented exemption comment.

### Summary

The unit builds and checks clean, and no quality target was lowered. The one significant concern is that the approved u4 accessibility repair is app-wide rather than limited to the catalog list, which can mislabel tables on guardrails screens or mask real findings. The rest are minor, openly documented limits.
