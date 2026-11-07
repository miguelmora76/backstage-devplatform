# Reliability Design — u1-data-and-server

Sources: `reliability-requirements.md` (NFR7.1–NFR7.7), `functional-spec.md` and `rules.md` (BR1.1, BR2.3, BR2.4, BR2.5, BR3.1–BR3.4, BR4.1), `tech-stack-decisions.md` (seeded random generator, container) and `contract-summary.md` (contract C2 error codes; contract C4 health check). There is no availability target; the design aims for identical start-up and predictable failure.

## Repeatable Data (NFR7.1, NFR7.2)

- The generator uses a small seeded random number generator written in the project that works only with whole-number arithmetic, so its results do not depend on the machine or the Node.js version. The platform's own random function and clock are never called by the generator.
- Every list is put in a fixed order before it is written (services by name, dependencies by service then name, runs by service then run number), and names are compared by their character codes, never by locale rules, so ties cannot reorder between machines.
- The set is written in one fixed form: fixed field order, two-space indent, line-feed endings, one trailing line feed, whole numbers without exponent forms.
- The default seed is a constant in the code. The start line prints the seed in use.
- The repeatability test compares two builds byte for byte and compares the output against a stored copy of the default data set kept with the tests, so a change that alters the default data is seen and must be made on purpose. CI runs it on a different machine from the developer laptop; that CI job is defined in the pipeline set up with the first Bolt and extended in u5-compose-and-ci. Only the pinned Node.js version is tested; the whole-number arithmetic is what carries the claim to other versions.

## Safe Writes (NFR7.4, NFR7.5)

- Every tool handler starts with the failure gate: if the failure setting is on, it returns FORCED_FAILURE and touches nothing. The setting is read once at start and never changes.
- Apply and re-run only add a key to a set. Adding a key that is already there changes nothing, so repeating a write after a timeout is harmless.
- A write has no partial state: it is a single set insertion.

## Restart (NFR7.3)

The overlay is created empty at start and nothing is saved. A restart gives the seeded state. A test applies an upgrade, rebuilds the server state from the same seed and compares it with a fresh one.

## Start-up and Health (NFR7.6, NFR7.7)

- Order at start: read and validate settings, build the data set, build the prepared lists, register the tools, open the port, and only when the port reports that it is listening set the ready flag and write the start line. Setting the flag in the listening callback, not in the same step as the open call, is what makes the not-ready window real: a probe that arrives between the open and the callback sees not ready.
- An invalid setting writes one fixed sentence naming the setting and the expected form (never the value) and exits with a non-zero code before anything else happens.
- The health route answers ready only when the ready flag is set. Before that it answers not ready. Because the port opens just before the flag is set, a health probe in that short window sees not ready, which is the reachable case of BR4.1.
- Compose makes the Backstage app wait for the health check (u5).

## Unexpected Errors

A handler is wrapped so that any unexpected error becomes a tool error with the code INTERNAL_ERROR and a fixed message, and the server keeps running. The log line records the code only.

### Changes to carry into Code Generation (decision Q3: A)

INTERNAL_ERROR is not yet in the functional rules or the contract, and the approved functional design is not edited here. It is carried into this unit's Code Generation step, which writes these together with the changes listed in `functional-spec.md` (Changes to the Contract Raised Here):

| Where | Change |
|---|---|
| `rules.md` BR3.3 and `entities.md` ToolError | Add INTERNAL_ERROR to the allowed codes; it applies only when no earlier check fits and a handler fails unexpectedly |
| `contract-summary.md` C2 | Add INTERNAL_ERROR to the error code lists of all four tools (additive) |
| u2-plugin-backend | Treats any error code it does not recognize as a failed call (a failed apply, or the server-error case on reads); this is recorded for u2's Functional Design |

## Recovery

Recovery is a restart; there is nothing to back up or fail over.

## Not Used, and Why

| Option | Why not |
|---|---|
| Retries or circuit breakers inside the server | The server calls nothing; the caller owns retries (contract C2) |
| Persisting the overlay | The server is meant to reset on restart (BR2.5) |
