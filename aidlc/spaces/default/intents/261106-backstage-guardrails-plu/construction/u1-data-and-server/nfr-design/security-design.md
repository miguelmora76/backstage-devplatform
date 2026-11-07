# Security Design — u1-data-and-server

Sources: `security-requirements.md` (NFR5.1–NFR5.7 and the accepted hosting-later risk), `functional-spec.md` and `rules.md` (BR3.2, BR3.3, BR3.4, BR4.2, BR4.3), `tech-stack-decisions.md` (TypeScript on Node.js, container image), `contract-summary.md` (contract C2 and C4) and the construction guardrails (no hard-coded secrets, validate inputs at boundaries). Deployment shape: single-user, local, synthetic data, no personal data, no secrets, no sign-in.

## Defense Layers

| Layer | Design | Requirement |
|---|---|---|
| Network | In the compose run the server has no published port; the Backstage app reaches it by service name on the internal network. | NFR5.5 (checked in u5) |
| Routes | The HTTP server answers only the MCP route and the health route. Every other path or method gets 404 or 405 with a fixed body that echoes nothing from the request. | NFR5.1 |
| Tools | Exactly four tools are registered. A call to any other tool name is refused by the MCP kit before it reaches any handler. No tool returns the whole data set. | NFR5.1 |
| Input | Each tool is registered with a permissive input shape, so the MCP kit rejects nothing before the handler runs and the order of checks stays ours. Inside the handler the order is exactly the one in the functional rules (BR3.1, BR3.3, BR3.4): the failure gate first (FORCED_FAILURE), then the input form (a missing, empty or non-text value is INVALID_INPUT), then the service (UNKNOWN_SERVICE), then the dependency or run key (UNKNOWN_DEPENDENCY or UNKNOWN_RUN). There is no character-set or length rule: any text that is not a known service or key simply returns the matching UNKNOWN code, however odd or long it is. Extra fields are ignored. Because every call reaches the handler, every call gets a log line. | NFR5.3 |
| Messages | Every error message is a fixed sentence chosen by the error code; no message includes caller text. A caller's string is therefore never reflected back or written to the log. | NFR5.3 |
| State | The only mutable state is the in-memory overlay. No file is opened for writing after start (the log goes to standard output). | NFR5.2 |
| Settings | A single settings reader validates seed, failure mode and port at start. On failure it writes one fixed sentence that names the setting and the expected form but not the offending value, and exits with a non-zero code. | NFR5.4 |
| Image | Multi-stage build; the final stage holds only the compiled output and production dependencies; it runs as a non-root user; it exposes one port. The image is built in this unit's Bolt; the check that the running container is non-root is made in u5-compose-and-ci, where the container is run. | NFR5.6 |
| Secrets | There are none. No setting, image layer or log line holds a credential. | NFR5.7 |

## Authentication and Authorization

None, by decision (NFR Requirements Q3: A). Authorization is not meaningful here: the server records no user and no approval, and the approval rules live in the plugin backend.

## Hosting Later: How the Caller Check Would Be Added

When a hosted version is wanted, the server gains an optional setting that holds a shared token. When the setting is present the server refuses calls without the matching token in the request header, and the check runs before any other check on the MCP route; the health route stays open so the platform can probe it. The comparison is constant-time, and a hosted deployment must also sit behind encrypted transport (TLS), which the server does not provide itself. When the setting is absent the server behaves as today. The plugin backend gains a matching optional setting and sends the header when it has a token. Callers that do not send a token keep working only while the server's setting is absent, so the change is additive for configuration but must be made on both sides together. Contract C2 gets the header as an additive item at that time. Nothing in this unit's design blocks it.

## Threat Handling

| Threat | Handling |
|---|---|
| Log or response injection through a service name, key or run key | Errors use fixed text, and the log line writes the service name only when it matches a known service (see the observability design) |
| Crash on odd input | Inputs are only compared with known names and keys, never interpreted; any unexpected error inside a handler is caught and returned as a tool error without the caller's text |
| Bulk reading of the data | No tool or route returns the data set |
| Replay or duplication of a write | Writes are safe to repeat (reliability design) |
| Container breakout through extra privileges | Non-root user, no extra capabilities requested in compose (u5) |
