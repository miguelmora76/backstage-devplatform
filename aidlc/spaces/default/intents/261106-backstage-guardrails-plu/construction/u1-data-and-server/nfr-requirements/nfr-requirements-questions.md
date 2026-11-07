# NFR Requirements — u1-data-and-server — Questions

This unit is the synthetic guardrails server and its seed data generator, run as its own container on a developer laptop. Already fixed by earlier stages, so not asked again: tools never retry on their own; the plugin backend gives up on a read after 3 seconds and a write after 10 seconds (contract C2); data lives in memory and is reloaded from the seed on restart; a start-up failure setting exists for tests; the same seed always gives the same data (NFR7); the sample runs locally only, with the option to host it later; at least 85% line coverage and CI-run tests (NFR2); Prettier and ESLint (NFR6).

Settled as targets without asking (written into the requirements for you to correct): each tool answers in at most 200 milliseconds at the 95th percentile on the seeded data set, measured inside the container; the server starts and answers its health check within 10 seconds of the container starting; the server needs no more than 256 MB of memory and one processor core; it handles at least 10 calls at the same time without error (the sample has one browser user).

## Q1. [Architecture] What should the server be written in?

Why we ask: the rest of the project is TypeScript on Backstage, and the server uses the Model Context Protocol (MCP) kit that both the TypeScript and Python worlds offer. One language means one toolchain, one formatter and linter setup, and one coverage report. Recommendation: A.

- A. TypeScript on Node.js, using the official MCP TypeScript kit, in the same workspace as the plugins
- B. Python, using the official MCP Python kit, with its own toolchain and tests
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q2. [Operations] What should the server write to its log?

Why we ask: the demo is run by one person, and logs are how they see what the plugin backend asked for. Recommendation: A.

- A. One line per tool call on standard output: time, tool name, service, result (ok or the error code) and duration. No other data from the call. Plus one line at start with the seed and the failure setting
- B. Only the start-up line and errors
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q3. [Security] Should the server check who is calling it?

Why we ask: the server has no sign-in. In the compose run only the Backstage app needs to reach it; if the sample is hosted later, anyone who can reach its port could apply an upgrade. Recommendation: A, because the sample is local only and the team wants to avoid choices that block hosting later, not to build for it now.

- A. No check now. The compose run does not publish the server's port to the host machine, so only the Backstage app can reach it. The hosting-later risk is recorded in the requirements
- B. A shared secret: the plugin backend sends a token from a setting and the server refuses calls without it
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- The server is written in TypeScript on Node.js with the official MCP TypeScript kit, in the same workspace as the plugins (Q1: A)
- The server logs one line per tool call (time, tool, service, result, duration; nothing else from the call) and one start line with the seed and failure setting (Q2: A)
- The server does not check its callers; the compose run does not publish its port to the host machine, and the hosting-later risk is recorded in the requirements (Q3: A)
- Targets set without asking: 95th percentile of at most 200 ms per tool call, ready within 10 seconds of container start, at most 256 MB of memory and one core, at least 10 simultaneous calls without error

- Looks correct
- Request changes

[Answer]: Looks correct
