# guardrails-server

A synthetic guardrails server for the Backstage guardrails sample, plus the seeded generator that feeds it. It is an MCP server over streamable HTTP with four tools. All data is invented, lives in memory and is lost on restart.

| Tool                       | Does                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `list_upgrade_plan`        | Every dependency of a service with current and recommended version, ordered by name |
| `list_failed_ci_runs`      | The service's currently failed CI runs with causes, newest first                    |
| `apply_dependency_upgrade` | Sets a dependency's current version to the recommended one; safe to repeat          |
| `rerun_ci_job`             | Re-runs a CI job so it leaves the failed list; safe to repeat                       |

Every failed call is a tool error (`isError: true`) whose structured content holds a `code` and a fixed `message`: `UNKNOWN_SERVICE`, `UNKNOWN_DEPENDENCY`, `UNKNOWN_RUN`, `INVALID_INPUT`, `FORCED_FAILURE` or `INTERNAL_ERROR`. The contract is in `contract/c2-tools.json`.

Routes: `POST /mcp` (the tools) and `GET /healthz` (`200 {"status":"ok"}` once ready). Everything else is refused with a fixed body.

## Settings

Environment variables, read once at start. An invalid value stops the server with one sentence naming the setting and exit code 1.

| Setting                   | Meaning                                               | Default                              |
| ------------------------- | ----------------------------------------------------- | ------------------------------------ |
| `PORT`                    | Port to listen on (1 to 65535)                        | none, required (`7007` in the image) |
| `GUARDRAILS_SEED`         | Whole-number seed; the same seed gives the same data  | `20261106`                           |
| `GUARDRAILS_FAILURE_MODE` | `on` makes every tool call fail with `FORCED_FAILURE` | `off`                                |

## Run, test, generate, build

Run these from the project root (Yarn classic and a current Node.js are needed; Docker only for the image).

```
yarn install
yarn --cwd packages/guardrails-server build
PORT=7007 node packages/guardrails-server/dist/main.js        # run the server

yarn --cwd packages/guardrails-server backstage-cli package test --watchAll=false             # all tests of this package
yarn --cwd packages/guardrails-server backstage-cli package test --watchAll=false --coverage  # coverage, 85% line floor
yarn --cwd packages/guardrails-server backstage-cli package lint
yarn tsc -p packages/guardrails-server

node packages/guardrails-server/dist/generator/cli.js [--seed <n>]   # print the data set, byte-for-byte repeatable

docker build -f packages/guardrails-server/Dockerfile -t guardrails-server .
docker run --rm --read-only -e PORT=7007 guardrails-server
```

## Layout

- `src/generator/` seeded generator, serializer and command (the only place the random generator is used)
- `src/store/` read-only data store, in-memory overlay and the combined data layer
- `src/tools/` the four handlers (failure gate, input check, error mapper, call log) and their registration
- `src/app.ts` HTTP shell, route allowlist and ready flag; `src/run.ts` start-up order; `src/main.ts` process entry
- `src/probe/` container health probe and smoke call (Node.js scripts; the image has no curl)
- `contract/c2-tools.json` machine-readable C2 spec; `src/testing/contractCheck.ts` is the check u2 runs on its stand-in
- `test-data/default-data-set.json` stored copy of the default data set; the repeatability test fails when the generator differs, so a change to the default data is made on purpose and the copy is regenerated in the same change (see `test-data/README.md`)
- `Dockerfile` multi-stage, non-root, one exposed port, no root file system writes
