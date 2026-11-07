# CI/CD Pipeline — u1-data-and-server

Sources: `team-practices.md` (pull requests, CI before merge and green, Prettier and ESLint, 85% coverage, nothing deploys automatically), `requirements.md` (FR10.1, NFR2, NFR6), `bolt-plan.md` (the pipeline is created with the first Bolt built and extended in u5), `tech-stack-decisions.md`, the NFR Design documents for this unit and answers Q4 in `infrastructure-design-questions.md`. This unit adds its jobs to the shared GitHub Actions workflow; it does not own the workflow file.

## Build and Test Stages

The workflow runs on every pull request and on every push to `main`. A failed job fails the pull request (FR10.1).

| Stage | What it does | Gate |
|---|---|---|
| 1. Format | Prettier check over all server and generator code (NFR6.1) | Any difference fails |
| 2. Lint | ESLint with Backstage's usual settings | Any error fails |
| 3. Type check | TypeScript compile without output | Any error fails |
| 4. Tests and coverage | All unit tests, including the 200-call benchmark, the 10-call concurrency test, the log-line test and the settings tests; coverage report on the server and generator code | Any failing test fails; line coverage below 85% fails (NFR2, team practices) |
| 5. Repeatability | Builds the default data set twice and compares byte for byte, then compares with the stored copy kept with the tests (NFR7.1) | Any difference fails |
| 6. Contract check | Runs the contract tests that check the server's four tools against the C2 spec, using the same spec check u2 runs on its stand-in | Any mismatch fails |
| 7. Image build | Builds the container image without pushing it; checks that the final stage runs as a non-root user and exposes one port (NFR5.6) | Build failure or a root user fails |
| 8. Container smoke test | Starts the built image, waits for the health route, calls one tool, stops it | Not ready within 10 seconds, or a failed call, fails (NFR1.2, NFR7.7) |

Stages 1 to 4 run in parallel jobs; 5 and 6 run after 4; 7 and 8 run after 5 and 6. Stage 8 needs Docker on the CI runner, which GitHub-hosted runners provide.

## Deployment Strategy

None. Nothing deploys automatically (team practices) and the image is not pushed anywhere (Q4: A). The way the sample is run is the compose command defined in u5-compose-and-ci.

## Rollback

There is nothing to roll back in an environment. A bad change is undone by reverting its pull request on `main`; the next run of the pipeline checks the revert.

## Environment Promotion

None: there is one environment, the developer laptop. If hosting is added later, a promotion path (build once, run the same image in each environment) is a new design.

## Secrets in the Pipeline

The pipeline needs none: it pushes nothing and calls no outside service. It uses only the repository's default token to read the code. No secret is added to the repository settings for this unit.

## Branching

Each Bolt is its own short-lived branch merged through a pull request after review (team practices). The pipeline's required checks are the eight stages above.

## Dependencies on Other Units

- The workflow file and its first four jobs are created with the first Bolt built (the workspace and pipeline setup in the Bolt plan); this unit adds stages 5 to 8.
- The same contract check runs in u2-plugin-backend's pipeline for its stand-in; both must pass for contract C2 to be considered held.
- u5-compose-and-ci extends the workflow with the compose run and repeats the performance and non-root checks against the running compose service.
