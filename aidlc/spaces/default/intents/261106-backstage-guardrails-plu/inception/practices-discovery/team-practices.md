# Team Practices

## Way of Working

- We use short-lived feature branches, each merged into `main` through a pull request.
- Each piece of work gets its own branch and is reviewed in its pull request before merging.
- Commits go on the branch we are already on; we create new branches per piece of work.

## Walking Skeleton

- No. We build piece by piece in the planned order, without a thin end-to-end slice first.

## Testing Posture

- **Methodology**: tdd
- **Ordering**: For each layer, write a failing test before writing the code that makes it pass.
- **Methodology evidence**: The team chose test-first (test-driven) development in the interview (Q3: B); no existing code or history exists to suggest otherwise.
- Coverage: at least 85% line coverage on the plugin code, and CI runs the tests before merge and must be green (Q4).
- Build and Test may not weaken the coverage floor to pass.

## Deployment

- Local only: we run with docker compose, and minikube is optional.
- Nothing deploys automatically.
- We keep the ability to deploy to hosted environments later, so we avoid choices that would block that.

## Code Style

- We use Prettier and ESLint with Backstage's usual settings, enforced in CI; a failure blocks the pull request.
- Language-idiomatic naming (camelCase for variables and functions, PascalCase for types); no project-wide rename rules.
