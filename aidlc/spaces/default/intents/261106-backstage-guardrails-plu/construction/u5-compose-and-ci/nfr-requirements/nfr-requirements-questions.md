# NFR Requirements Questions — u5-compose-and-ci

Context: u5 adds no behavior. It builds the one-command run (docker compose) and extends the GitHub Actions pipeline. Its non-functional work is mostly the checks that earlier units could not make without the whole sample running: u4 handed over the timing of the views (20 loads, 95th percentile at most 5 seconds, NFR1), the real-browser checks in current Chrome and Firefox (NFR4), colour contrast and focus behavior (NFR3), the origin and content-policy headers, and the sign-in-to-plan-load step with a real token.

Settled without asking (written into the documents for you to correct):
- Compose runs three containers: the guardrails server (the image u1 built), the app (one image: the backend serving the built frontend, from u4's build output) and PostgreSQL 16 with a named volume. The app uses u4's two-file form of settings, so the PostgreSQL file is exercised for real. Nothing is published except the app's port, bound to 127.0.0.1; the app's two base addresses are equal (`http://localhost:7007`).
- All containers run as a non-root user with a read-only root file system where the image allows it. Images are pinned to a version. No secret is committed: the database password is a throw-away value created by the start script into an untracked `.env`, and `.env.example` stays free of passwords.
- Compose turns the demo sign-in on (`GUARDRAILS_DEMO_SIGN_IN=true`) because the sample has no other way in; the README states that it must be replaced before any hosting.
- The compose run waits for each container's health check, so "up" means the app answers its readiness route, not that a process started. A start with `GUARDRAILS_SERVER_URL` missing is shown to fail with a non-zero exit code and a message naming the setting.
- The pipeline's existing jobs stay as they are. u5 adds the compose end-to-end job, the image build for the app (not pushed, same checks as the server image: non-root, one port) and a final job that the pull request's required status can point at. Nothing deploys and no secret is used. Making a failed check block a merge is a GitHub repository setting; the README says how to set it, and I cannot set it from the code.
- Commands that cost time are bounded: the whole compose job fails after 15 minutes, and a compose start that is not ready within 3 minutes fails.
- A real screen reader cannot run in a pipeline. The automated pass checks the accessibility tree and labels in real browsers; the pass with an actual screen reader is a short manual checklist you run once, recorded as open until you do it.
- The repeatable data and the 85% line-coverage floors stay where u1 to u4 put them and are not lowered.

## Q1. [Quality] How should the real-browser checks run?

Why we ask: u3 and u4 could only scan their screens in a simulated browser. What is left (colour contrast, real focus behavior, the flows in Chrome and Firefox, the response headers, the sign-in-to-plan-load step) needs the running sample. A browser test tool can run these on every pull request against the compose sample: it adds one development dependency (Playwright, with Chromium and Firefox downloaded on the pipeline) and about five minutes to the compose job. Without it, the same checks are a written checklist you run by hand, and a regression would not fail a pull request.
Recommendation: A, because the intent says a failing check must fail the pull request, and these are the checks left that nothing else makes.

- A. Automated: Playwright runs the flows in Chromium and Firefox, a real-browser accessibility scan and the header and token checks on every pull request
- B. Partly automated: the header and token checks run on every pull request (plain HTTP calls, no browser tool); the browser flows, contrast and focus are a written checklist you run by hand
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q2. [Quality] Where does the 20-load timing (95th percentile at most 5 seconds) block?

Why we ask: the requirement says each view is measured on a developer laptop running the compose sample. A GitHub-hosted runner is shared and usually slower and noisier than a laptop, so a timing check there could fail a pull request for reasons unrelated to the change. On the other hand, a check that never blocks lets a slow view through unnoticed. The synthetic data is small, so the views should be well under the limit on either.
Recommendation: A, because a 5-second limit is generous for this data and a blocking check is the only one that is noticed; if it ever flakes, the finding is worth knowing about and we can revisit it then.

- A. Blocks on the pipeline: the 20 loads run in the compose job and the pull request fails if the 95th percentile is over 5 seconds; the same command runs on your laptop
- B. Reports only on the pipeline (the numbers are kept as a build artifact); it blocks only when you run the command on your laptop
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Real-browser checks are automated: Playwright runs the flows in Chromium and Firefox, a real-browser accessibility scan, and the header and token checks on every pull request (Q1: A)
- The 20-load timing check blocks on the pipeline: the pull request fails when the 95th percentile of any view is over 5 seconds, and the same command runs on a laptop (Q2: A)
- Settled without asking: three containers (guardrails server, app, PostgreSQL 16 with a volume) using u4's two-file settings; only the app's port, on 127.0.0.1; non-root, pinned images, no committed secret; demo sign-in on in compose and flagged for replacement before hosting; health-checked start with a failing start shown when the server address is missing; existing CI jobs kept and a compose end-to-end job, an app image build and a final summary job added; time limits on the compose job; real screen-reader pass left as a manual checklist; coverage floors not lowered

- Looks correct
- Request changes

[Answer]: Looks correct
