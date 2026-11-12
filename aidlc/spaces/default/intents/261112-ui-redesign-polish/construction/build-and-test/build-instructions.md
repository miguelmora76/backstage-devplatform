# Build Instructions: UI Redesign

## Prerequisites

- Node.js 22 or later and Yarn classic (1.x); Docker for the compose run. Nothing else is new for this work.

## Dependencies

```bash
yarn install
```

The work added two direct dependencies to `packages/app`: `@backstage/ui` ^0.19.0 (the stylesheet) and `@backstage/plugin-user-settings` ^0.9.8 (the light/dark switch). Both are in `packages/app/allowed-packages.txt`.

## Environment

No new environment variables or settings. The compose run creates `.env.compose` on first use (see `README.md`).

## Build and verify

```bash
yarn tsc && yarn lint && yarn prettier:check
yarn test --watchAll=false --coverage --testPathIgnorePatterns packages/guardrails-server/src/performance.test.ts
yarn workspace guardrails-server test --watchAll=false src/performance.test.ts
yarn compose:reset && yarn compose:up
yarn workspace e2e playwright test --project chrome --project firefox --no-deps layout a11y flows keyboard tree
yarn e2e checks
yarn e2e:timing
```

`yarn compose:reset` first, because `flows.spec.ts` only passes on a freshly seeded database. `yarn e2e specs` runs the whole pipeline of projects, so the Playwright command is run directly.

## Troubleshooting

- **A page is blank in Safari:** the content policy must not carry `upgrade-insecure-requests` (fixed in the previous change, rule `csp-no-upgrade`).
- **`flows` fails on "Page 1 of 1":** leftover test data; run `yarn compose:reset` and bring the stack up again.
- **Firefox accessibility specs are skipped:** the existing, annotated workaround for a Firefox page crash on macOS arm64; Chrome runs every screen.
