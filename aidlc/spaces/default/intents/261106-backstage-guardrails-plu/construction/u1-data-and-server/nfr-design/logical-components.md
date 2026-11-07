# Logical Components — u1-data-and-server

Sources: the five design documents in this folder, `functional-spec.md` and `entities.md` (what the unit does and owns), `components.md` (GuardrailsServer and SeedDataGenerator), `tech-stack-decisions.md` and `contract-summary.md` (contracts C2 and C4). This is a component-level view of where each NFR pattern applies; it does not decide the file layout.

## Components

| Component | Responsibility | Patterns it carries | Belongs to |
|---|---|---|---|
| Settings reader | Reads and validates seed, failure mode and port; stops with one fixed sentence on error | Fail fast at start | GuardrailsServer |
| Seeded generator | Builds the data set from the seed; the only place the random generator is used | Whole-number arithmetic, fixed ordering, fixed serialization, test-only size factor | SeedDataGenerator |
| Generator command | Prints the data set for the byte-for-byte comparison | Same function as the server's start-up call | SeedDataGenerator |
| Data store | Holds the loaded data set (read only) and the prepared, ordered lists | Build once, read many | GuardrailsServer |
| Overlay | Holds the two key sets (upgraded dependencies, re-run runs) | In-memory only, one synchronous step per write | GuardrailsServer |
| Input check | Checks inside the handler, after the failure gate, that each required input is present, non-empty text | Fixed check order (BR3.1, BR3.3, BR3.4); extra fields ignored | GuardrailsServer |
| Failure gate | Returns FORCED_FAILURE first when the setting is on | Same check at the start of every handler | GuardrailsServer |
| Four tool handlers | Plan, failed runs, apply, re-run | Safe to repeat, fixed error order | GuardrailsServer |
| Error mapper | Turns every failure into a tool error with a code and a fixed message; unexpected errors become INTERNAL_ERROR | Fixed text, no caller input | GuardrailsServer |
| Call logger | Writes the start line and one line per call | Dash for unknown service, fixed shape | GuardrailsServer |
| HTTP shell | Hosts the MCP route and the health route; refuses all else | Route allowlist, ready flag set in the listening callback | GuardrailsServer |
| Container image | Packages the compiled server | Multi-stage build, non-root user, one exposed port | GuardrailsServer (built here, run and checked in u5) |
| Compose service entry | Runs the image with limits, health check and no published port | Memory and processor limits, health-based start order | u5-compose-and-ci |

## Failure Domains and Blast Radius

| Domain | What fails together | Blast radius |
|---|---|---|
| The server process | Everything above | The plugin backend sees an unreachable server (its own handling, contract C2); no other unit is affected; a restart restores the seeded state |
| A single tool call | Its handler only | Returns a tool error; the next call is unaffected |
| The generator command | Run on its own | Affects only the comparison check |

## Shared Resources

- Standard output (the log) is shared by all components but written only by the call logger.
- The container image is shared with nothing: u1 ships its own image (contract C4 settings, no published port in compose).
- The overlay is the only mutable state and has one writer path.

## Where NFRs Apply

| Requirement | Component |
|---|---|
| NFR1.1, NFR1.3 | Data store, seeded generator |
| NFR1.2, NFR7.6, NFR7.7 | Settings reader, HTTP shell |
| NFR1.4 | Overlay, tool handlers |
| NFR1.5 | Seeded generator |
| NFR5.1–NFR5.4 | HTTP shell, input check, error mapper, settings reader |
| NFR5.5–NFR5.7 | Image and compose (u5) |
| NFR7.1, NFR7.2 | Seeded generator |
| NFR7.3, NFR7.5 | Overlay, tool handlers |
| NFR7.4 | Failure gate |
| NFR1.6, NFR1.7 | Call logger |
| NFR1.8 | HTTP shell (health route) |
| NFR2.1–NFR2.8, NFR6.1 | The whole unit: language, kit, test and coverage setup, formatting and linting, generator, image and settings (see the tech stack decisions) |
| NFR5.5, NFR5.6, memory and processor limits | Container image and compose service entry (checked in u5) |
