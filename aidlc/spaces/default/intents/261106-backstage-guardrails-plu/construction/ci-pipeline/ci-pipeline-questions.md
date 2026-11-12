# CI Pipeline Questions

Already settled, so not asked again: the CI tool is GitHub Actions (`.github/workflows/ci.yml`, built by u5 and u6); the branch strategy is short-lived feature branches merged into `main` through a pull request (team practice); the merge gate is the single `ci-ok` status, now required on `main` by branch protection (Build and Test, evidence BP).

## Q1. [Delivery] Where should the built images go?
The pipeline builds the app and guardrails server images in the `app-image` and `image` jobs. The team practice says nothing deploys automatically and everything runs locally, so the images may simply stay in the job. Publishing is only needed if you want to pull them from a registry later.

A. Nowhere: build and check the images in the pipeline only; nothing is published (matches "local only, nothing deploys")
B. Publish to GitHub Container Registry on merge to `main`, for pulling later
X. Other (please specify)

[Answer]: B (superseded by Q3: nothing is published)

## Q2. [Quality] Should the Safari fix get an automatic check in the pipeline?
Today the content-policy rule is covered by a settings test, but no pipeline job opens the app in Safari (the pipeline's browsers are Chromium and Firefox). A cheap extra gate would be a WebKit run of the existing sign-in and catalog specs, which approximates Safari.

A. No: keep the current gates; the settings test (`csp-no-upgrade`) is enough for now
B. Yes: add a WebKit run of the sign-in and catalog specs to the `compose-e2e` job
X. Other (please specify)

[Answer]: A

## Q3. [Delivery] Your answer to Q1 (publish images on merge) conflicts with a rule from the compose unit. How should we settle it?
That unit's pipeline requirement says the pipeline can only read the code: no registry login, no image push, no job-level write permission (the rule NFR5.9, and NFR2.17 "nothing deployed"), and the team practice says nothing deploys automatically. Publishing to GitHub Container Registry needs write permission for one job. Picking B for Q1 means changing that rule; picking A keeps it.

A. Keep the rule: nothing is published (Q1 becomes "nowhere")
B. Change the rule: one extra job on merge to `main` only, with `packages: write` for that job alone, nothing else widened; the compose unit's workflow test is updated to allow exactly that job
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
