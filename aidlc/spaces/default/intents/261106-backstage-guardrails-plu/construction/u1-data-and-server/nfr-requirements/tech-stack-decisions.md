# Tech Stack Decisions — u1-data-and-server

Sources: `requirements.md` (constraints: TypeScript on Backstage; guardrails server in its own container; local only, hosting later possible; NFR2 coverage; NFR6 style), `contract-summary.md` (contract C2: MCP over streamable HTTP; C4 settings and health), `team-practices.md` (tests first, 85% coverage, Prettier and ESLint, docker compose) and answers Q1–Q3 in `nfr-requirements-questions.md`.

| ID | Decision | Choice | Rationale |
|---|---|---|---|
| NFR2.1 | Language and runtime | TypeScript on a current long-term-support Node.js release, version pinned in the lock file and the image | One language for the whole project (Q1: A); matches the stated constraint; one toolchain for formatting, linting and coverage |
| NFR2.2 | Protocol kit | The official Model Context Protocol TypeScript kit, serving over streamable HTTP | Contract C2 requires MCP over streamable HTTP; the official kit keeps the stand-in close to a real MCP server |
| NFR2.3 | HTTP serving | A minimal HTTP server hosting the MCP route and the health route | Only two routes are needed; avoids a large framework |
| NFR2.4 | Workspace and package manager | The same Backstage workspace as the plugins, with the package manager Backstage's scaffolder sets up | One lock file, one CI setup; Backstage's usual settings apply (NFR6.1) |
| NFR2.5 | Tests and coverage | Backstage's usual test runner with its coverage report; tests written before the code for each layer; at least 85% line coverage on the server and generator code, enforced in CI | Team practice (tests first) and NFR2; no extra tool |
| NFR6.1 | Formatting and linting | Prettier and ESLint with Backstage's usual settings, enforced in CI | NFR6 and team practice |
| NFR2.6 | Data generation | A small seeded random number generator written inside the project, not the platform's random function, and a fixed serialization order | Byte-for-byte repeatability across machines and Node versions (BR1.1, NFR7.1) |
| NFR2.7 | Packaging | A multi-stage container image: build in one stage, run the compiled output in a small Node.js image, non-root user, one exposed port, no published port in compose | Own container (feasibility Q2); NFR5.5 and NFR5.6; hosting later stays possible because the address is a setting |
| NFR2.8 | Configuration | Environment variables only: GUARDRAILS_SEED, GUARDRAILS_FAILURE_MODE, PORT | Contract C4; no address or path hard-coded (hosting-later check) |

## Alternatives Considered

| Alternative | Why not |
|---|---|
| Python with the official MCP kit (Q1: B) | A second toolchain, formatter, linter and coverage report for one small service |
| Plain REST instead of MCP (Contract Design Q3: B) | Rejected earlier; the stand-in should behave like the real MCP server |
| A database or file for applied changes | The server is meant to reset on restart (BR2.5); a store would add a failure mode and a reason to migrate |
| A large web framework | Two routes do not need one |

## Notes for Later Stages

- The exact versions are chosen when the workspace is created in the first Bolt and recorded in the lock file.
- NFR Design (next stage) turns the choices above into patterns: how the generator is structured, how overlapping writes are ordered, and how the log line is produced.
