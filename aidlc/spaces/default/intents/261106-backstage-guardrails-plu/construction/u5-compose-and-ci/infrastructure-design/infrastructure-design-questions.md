# Infrastructure Design Questions — u5-compose-and-ci

Context: u5 is the unit that creates the run files, so this stage maps the reviewed design onto the concrete things that exist: one compose file, one image build file, one environment file, and the pipeline. The team practices fix the big choices (local only, docker compose, nothing deploys automatically, GitHub Actions), and the earlier answers fixed the rest, so there are no open questions.

Settled without asking (written into the documents for you to correct):
- No cloud resource of any kind. The only places anything runs are your machine (compose) and GitHub-hosted runners (the pipeline). There is one environment, "local".
- Memory limits are set generously so a runaway container cannot take the machine: app 1 GB, guardrails server 256 MB, database 512 MB. They are revised in Code Generation if a real run needs more, and the change is recorded.
- Local image names are `guardrails-app:local` and the u1 server's existing name; the pipeline builds `:ci` copies that are never pushed.
- The only monitoring is what a local sample needs: container health checks, the app's readiness route, logs through `docker compose logs`, and the timing numbers file of the end-to-end run. No alerting, no dashboards, no objectives.
- Secrets: only the generated database password in the untracked `.env.compose`. The pipeline uses no secret.
- Pipeline artifacts (the test report, the timing numbers, the coverage files) are kept 7 days; nothing else is uploaded.
- Hosting later: nothing in the files names your machine or a host. The same image, settings and variable names are what u6 (minikube) or a hosted environment would use; the demo sign-in and the database password handling are what must change first (stated in the README).

## Consolidated Summary Confirmation

- No open infrastructure questions; the choices follow the team practices (local only, docker compose, nothing deploys automatically) and the reviewed design
- Settled without asking: no cloud resource and one environment; memory limits of 1 GB (app), 256 MB (server) and 512 MB (database), revised if a real run needs more; local `guardrails-app:local` and pipeline `:ci` images never pushed; monitoring limited to health checks, the readiness route, logs and the timing numbers file; the generated database password in `.env.compose` as the only secret; pipeline artifacts kept 7 days; files free of host-specific names so u6 or a hosted environment can reuse them

- Looks correct
- Request changes

[Answer]: Looks correct
