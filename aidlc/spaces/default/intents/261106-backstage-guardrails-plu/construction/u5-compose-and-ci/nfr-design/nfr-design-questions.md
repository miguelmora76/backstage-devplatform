# NFR Design Questions — u5-compose-and-ci

Context: the requirements (`nfr-requirements/security-requirements.md` and `tech-stack-decisions.md`) are reviewed and settled, and the two real decisions of this unit (browser checks automated, timing blocks the pipeline) were answered there. What is left in design is how to meet those requirements with the files u5 adds, and every one of those has one sensible answer given what the earlier units built. So there are no open questions this time; the design decisions I settled are listed here for you to correct.

Settled without asking (written into `security-design.md`):
- Two compose networks: an `edge` network that only the app joins (it carries the one published port, on 127.0.0.1) and an `internal` network, marked internal, that holds the app, the guardrails server and PostgreSQL. The server and the database cannot be reached from the host and cannot reach the internet.
- The compose run reads its own untracked file, `.env.compose`, created by the start script (random database password, nothing else secret). It is separate from u4's `.env`, which `yarn start:local` reads with `localhost` addresses; mixing them would break one of the two runs. `.env.compose` is added to `.gitignore`.
- The app image copies the built frontend next to the backend bundle as the `app` package, so u4's package files are not touched. Because the app-backend plugin rewrites the frontend's JavaScript at start, the image keeps a pristine copy and the container copies it into a tmpfs at start, so the root file system can stay read-only. If a real run shows that does not work, the written exception of NFR5.3 is used and the reason is recorded.
- PostgreSQL runs as its own user with a tmpfs for `/tmp` and `/var/run/postgresql` and the named volume for data; if the image will not start that way in a real run, the same written exception applies.
- The missing-address check uses `docker compose run --rm --no-deps` on the already running stack, with the variable emptied, so the container joins the compose network and the database is reachable; the check then does not depend on the order of the app's own start-up steps.
- The new package is `packages/e2e`: `src/` holds the unit-tested TypeScript, `specs/` the Playwright specs (two browser projects, plus a timing project in Chrome only), `bin/` thin `.mjs` entries. Root scripts: `compose:up`, `compose:down`, `compose:reset`, `e2e`, `e2e:timing`.
- The workflow gets these new jobs: `e2e-unit` (the package's unit tests with coverage, no Docker, includes the compose-file and workflow checks), `app-image`, `compose-e2e` and `ci-ok`. `ci-ok` lists every job, old and new, in `needs`. The small edits to existing jobs are the three agreed in the requirements (time limits, exact PostgreSQL tag, the documented exemption of the throw-away database login).

## Consolidated Summary Confirmation

- No open design questions; the design follows the reviewed requirements and the two answers already given (browser checks automated, timing blocks the pipeline)
- Settled without asking: two networks (`edge` for the one published port on 127.0.0.1, `internal` for app, server and database); a separate untracked `.env.compose` with a random database password; the app image takes the built frontend as the `app` package with a pristine copy copied into a tmpfs at start so the file system stays read-only (written exception if a real run shows it cannot); PostgreSQL with tmpfs for `/tmp` and its socket directory; the missing-address check run with `docker compose run --rm --no-deps` on the running stack; the `packages/e2e` layout and root scripts; new jobs `e2e-unit`, `app-image`, `compose-e2e` and `ci-ok` with `ci-ok` covering every job

- Looks correct
- Request changes

[Answer]: Looks correct
