# Unit Test Instructions — u1-data-and-server

Sources: `code-generation-plan.md`, the Testing Contract in it (TDD, standard strategy, 85% line coverage), `rules.md` and the NFR design documents for this unit, `contract-summary.md` (contract C2) and the Bolt plan.

## Framework and Setup

- Test runner: the one Backstage's command-line tool provides (Jest), configured in Step 2 of the plan. No other test framework is added.
- Prerequisites: Node.js on the long-term-support line or newer, and Yarn classic (installed in Step 1 of the plan). Docker is needed only for the image build and the container smoke test (Steps 17 and the pipeline), not for the unit tests.
- Test files sit next to the code they test, named after the module with a `.test.ts` ending. The stored copy of the default data set and the contract spec file sit under the package's `test-data` and `contract` folders.

## Commands (scoped to this unit)

Run from the project root. All commands are limited to the package `packages/guardrails-server`.

| Purpose | Command |
|---|---|
| All tests of this unit, no watching | `yarn --cwd packages/guardrails-server backstage-cli package test --watchAll=false` |
| One test file | `yarn --cwd packages/guardrails-server backstage-cli package test --watchAll=false src/generator/generator.test.ts` |
| Coverage report for this unit | `yarn --cwd packages/guardrails-server backstage-cli package test --watchAll=false --coverage` |
| Format, lint, types for this unit | `yarn --cwd packages/guardrails-server backstage-cli package lint` and `yarn tsc -p packages/guardrails-server` |

The first command is created and proved to run in Step 2 of the plan, before any test-first step.

## Test Volume (standard strategy)

About 45 tests across these components, 5 to 8 each, plus the boundary and performance tests:

| Component | Tests | Kind |
|---|---|---|
| Seeded generator and serializer | 8 | Unit: repeatability, sizes, required cases, key shapes, ordering, version ordering, stored default copy, test-only size factor |
| Data store and overlay | 7 | Unit: prepared lists, overlay applied, apply, re-run, repeats, restart, empty services |
| Settings reader | 6 | Unit: valid values, each invalid setting, defaults, fixed sentence without the value |
| Tool handlers, failure gate, error mapper | 9 | Unit: success paths, empty lists, each error code and check order, failure gate first, idempotent writes, unexpected error |
| Call logger | 5 | Unit: call line shape, dash for unknown, markup and long input, start line, one line per call |
| HTTP shell and MCP route | 8 | Integration through the MCP client: four tools, tool list, refused paths, health before and after listening, failure mode, no file written |
| Performance and concurrency | 3 | Integration: 200-call benchmark at the 95th percentile, 10 simultaneous calls, large data set through the factory |
| Contract check | 3 | Contract: all tools against the spec, a wrong stand-in fails, error codes listed |

Every test covers the happy path and at least two error or edge cases per component (phase guardrail).

## Coverage Targets

- The floor is **85% line coverage on the server and generator code**. It is set in the coverage configuration in Step 2 and never lowered to make a run pass.
- This floor applies to the whole project and is judged by Build and Test on the full suite of the assembled project. A run of this unit alone should meet it too, since all measured code belongs to this unit for now; if the coverage command exits non-zero only on the threshold with every test passing, record it as a threshold result, not a failed test.
- The coverage command is a command of its own (the third row above) so a threshold exit never stops another step.

## Mocking and Stubbing

- No mocks for the code under test. The server is started for real on a free port in the integration tests and called with the MCP kit's client.
- The clock is the only thing replaced, and only in the log-line test (a fixed time) so the line can be compared. The generator never reads the clock.
- Standard output is captured in the logger tests to check lines.

## Test Data

- The default data set is generated from the fixed default seed; a stored copy is kept in `test-data/default-data-set.json` and the test fails if the generator's output differs, so a change to the default data is made on purpose and the stored copy is updated in the same change.
- Odd inputs used in tests: empty text, a very long text (10,000 characters), markup, a line break, a key from another service.

## Performance Checks

- The 95th percentile of 200 calls per tool must be at most 200 ms (NFR1.1); building the default data set at most 1 second (NFR1.3). These are tests, not separate tools, and a result above the target fails the run.
