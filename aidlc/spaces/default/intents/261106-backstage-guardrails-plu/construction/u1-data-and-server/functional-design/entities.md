# Entities — u1-data-and-server

Sources: `components.md` (GuardrailsServer and SeedDataGenerator entities), `unit-of-work.md` (u1 owns ServiceRecord, Dependency, CiRun, SeedDataSet), `contract-summary.md` (contract C2: tool inputs and outputs) and answers Q1–Q3 in `functional-design-questions.md`. The YAML block is the source of truth; the text after it is a summary.

```yaml
entities:
  - name: SeedDataSet
    owner: SeedDataGenerator
    description: The complete synthetic data set one seed produces. The server loads it at start and adds no data of its own.
    attributes:
      - { name: seed, type: integer, required: true, unique: true, constraints: "Whole number; same seed gives the same set, byte for byte" }
      - { name: synthetic, type: boolean, required: true, default: true, constraints: "Always true; marks every value as invented" }
      - { name: services, type: "list of ServiceRecord", required: true, constraints: "Ordered by serviceName" }
      - { name: dependencies, type: "list of Dependency", required: true, constraints: "Ordered by serviceName, then name" }
      - { name: ciRuns, type: "list of CiRun", required: true, constraints: "Ordered by serviceName, then runNumber" }
    constraints:
      - "No clock time, machine name or random value that is not derived from the seed appears in the set"
    relationships:
      - { to: ServiceRecord, cardinality: "1..*", direction: contains }
      - { to: Dependency, cardinality: "0..*", direction: contains }
      - { to: CiRun, cardinality: "0..*", direction: contains }

  - name: ServiceRecord
    owner: GuardrailsServer
    description: A synthetic service whose dependencies and CI runs the server reports.
    attributes:
      - { name: serviceName, type: string, required: true, unique: true, constraints: "Lowercase words joined by hyphens, for example checkout-api; treated as an opaque key by every other unit" }
    relationships:
      - { to: Dependency, cardinality: "0..*", direction: "has" }
      - { to: CiRun, cardinality: "0..*", direction: "has" }

  - name: Dependency
    owner: GuardrailsServer
    description: A library one service depends on, with the version it uses and the version recommended.
    attributes:
      - { name: dependencyKey, type: string, required: true, unique: true, constraints: "serviceName, a slash, then name; opaque to callers" }
      - { name: serviceName, type: string, required: true, references: ServiceRecord }
      - { name: name, type: string, required: true, constraints: "Unique within the service; invented name that looks like an open source package" }
      - { name: currentVersion, type: string, required: true, constraints: "Three whole numbers separated by dots; changed only by an applied upgrade, in memory" }
      - { name: recommendedVersion, type: string, required: true, constraints: "Same form; never lower than the seeded currentVersion; never changed after load" }
    relationships:
      - { to: ServiceRecord, cardinality: "many to one", direction: "belongs to" }

  - name: CiRun
    owner: GuardrailsServer
    description: One run of a service's CI pipeline.
    attributes:
      - { name: runKey, type: string, required: true, unique: true, constraints: "serviceName, a hash sign, then runNumber; opaque to callers" }
      - { name: serviceName, type: string, required: true, references: ServiceRecord }
      - { name: runNumber, type: integer, required: true, constraints: "From 1; unique within the service; higher is newer" }
      - { name: status, type: string, required: true, allowed: [failed, passed], default: passed, constraints: "A seeded failed run becomes passed after a re-run, in memory" }
      - { name: cause, type: string, required: "when status is failed in the seed", constraints: "Plain words, for example failing test; kept after a re-run so the history stays readable; absent on runs that were never failed" }
    relationships:
      - { to: ServiceRecord, cardinality: "many to one", direction: "belongs to" }

value_objects:
  - name: ToolError
    description: How a tool call reports failure. Not stored.
    attributes:
      - { name: code, type: string, required: true, allowed: [UNKNOWN_SERVICE, UNKNOWN_DEPENDENCY, UNKNOWN_RUN, INVALID_INPUT, FORCED_FAILURE, INTERNAL_ERROR] }
      - { name: message, type: string, required: true }
  - name: ServerSettings
    description: Start-up settings. Read once at start; never changed while running. Not stored.
    attributes:
      - { name: seed, type: integer, required: true, default: "fixed default seed baked into the image", constraints: "Set by the GUARDRAILS_SEED setting" }
      - { name: failureMode, type: string, required: true, allowed: [on, off], default: off, constraints: "Set by the GUARDRAILS_FAILURE_MODE setting" }
      - { name: port, type: integer, required: true, constraints: "Set by the PORT setting" }
  - name: RuntimeOverlay
    description: The changes made since start. Held in memory only and lost on restart, when the data is loaded again from the seed.
    attributes:
      - { name: upgradedDependencies, type: "set of dependencyKey", required: true, default: empty }
      - { name: rerunRuns, type: "set of runKey", required: true, default: empty }
```

## Summary

The unit owns four entities: `SeedDataSet` (everything one seed produces), `ServiceRecord`, `Dependency` and `CiRun`. Keys are readable strings (`checkout-api/left-pad-ng`, `checkout-api#17`) that every other unit treats as opaque. Three small non-stored objects complete the picture: `ToolError` (the failure code and message), `ServerSettings` (seed, failure mode, port) and `RuntimeOverlay` (which upgrades and re-runs have happened since start).

The server never writes to the data set. It combines the loaded `SeedDataSet` with the `RuntimeOverlay` to answer: a dependency is "current" when its key is in `upgradedDependencies` or its seeded versions already match, and a run counts as failed when it was seeded as failed and its key is not in `rerunRuns`. A restart empties the overlay.
