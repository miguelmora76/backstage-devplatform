# Rules — u1-data-and-server

Sources: `requirements.md` (FR6.1, FR6.2, FR7.1, FR7.2, FR1.1, FR2.1, FR3.6, NFR7), `stories.md` (US6.1, US1.1, US1.2, US3.3), `components.md` (GuardrailsServer and SeedDataGenerator behavior), `contract-summary.md` (contract C2 and its open review points) and answers Q1–Q3 in `functional-design-questions.md`. The YAML block is the source of truth; the table after it is a summary.

```yaml
rules:
  - id: BR1.1
    statement: The same seed always produces the same data set, byte for byte.
    category: constraint
    applies_to: SeedDataGenerator
    trigger: The generator runs, as a library at server start or from the command line
    logic: "IF two runs use the same seed THEN their serialized outputs are identical. The serialization has a fixed field order, a fixed list order, a fixed indent, line-feed line endings and one trailing line feed. No clock time, machine name, environment value or random value that is not derived from the seed is used."
    violation: A difference between two runs with one seed is a defect; a check compares the outputs byte for byte.
    source: FR7.2, NFR7
  - id: BR1.2
    statement: The data set is about 5 services with about 10 dependencies and 20 CI runs each, measured over the whole set.
    category: constraint
    applies_to: SeedDataGenerator
    trigger: The generator builds a data set
    logic: "IF the data set is built THEN the number of services is 4 to 6, the total number of dependencies is 40 to 60 and the total number of CI runs is 80 to 120. These are 20 percent either side of 5, 50 and 100. The counts are for the whole set because one service must have no dependencies (BR1.3)."
    violation: A count outside these limits is a defect in the generator.
    source: FR7.1
  - id: BR1.3
    statement: Every data set contains the cases the stories test.
    category: constraint
    applies_to: SeedDataGenerator
    trigger: The generator builds a data set
    logic: "IF the data set is built THEN it contains at least one service with no dependencies, at least one service with no failed CI runs (it still has passed runs), at least two dependencies whose currentVersion equals their recommendedVersion, and failed runs with at least four different causes. Every other value is derived from the seed."
    violation: A seed that would leave out a case is adjusted until the case is present; the same seed always gives the same adjusted result.
    source: FR1.1, FR2.1, FR7.1
  - id: BR1.4
    statement: All names and versions are invented, look realistic, and the set says it is synthetic.
    category: policy
    applies_to: SeedDataGenerator
    trigger: The generator builds a data set
    logic: "IF the data set is built THEN service names are lowercase words joined by hyphens, dependency names look like open source package names, versions have three whole numbers separated by dots, causes are everyday phrases such as failing test, lint error, dependency conflict, flaky timeout and build cache, and the field synthetic is true."
    violation: A value taken from real data is a defect.
    source: FR7.1
  - id: BR1.5
    statement: Keys are unique and built from the service name and a number or name.
    category: constraint
    applies_to: ServiceRecord, Dependency, CiRun
    trigger: The generator builds a data set
    logic: "IF the data set is built THEN serviceName is unique, dependencyKey is serviceName, a slash and the dependency name (unique within the service), and runKey is serviceName, a hash sign and the runNumber (numbers start at 1, are unique within the service, and a higher number is a newer run). Callers treat all keys as opaque text."
    violation: A duplicate key is a defect in the generator.
    source: FR6.1
  - id: BR1.6
    statement: The recommended version is never lower than the current seeded version.
    category: constraint
    applies_to: Dependency
    trigger: The generator builds a dependency
    logic: IF a dependency is built THEN recommendedVersion is greater than or equal to the seeded currentVersion, comparing the three numbers in order.
    violation: A lower recommendation is a defect in the generator.
    source: FR1.1

  - id: BR2.1
    statement: The upgrade plan lists every dependency of the service, including those already at the recommended version.
    category: policy
    applies_to: list_upgrade_plan
    trigger: A caller asks for the upgrade plan of a service
    logic: "IF the service exists THEN return all its dependencies, each with the dependency key, name, current version and recommended version, ordered by name; the current version of a dependency in upgradedDependencies equals its recommended version. IF the service has no dependencies THEN return an empty list, which is not an error."
    violation: An unknown service returns UNKNOWN_SERVICE.
    source: FR1.1, FR6.1
  - id: BR2.2
    statement: The failed CI runs list holds only runs that are currently failed, newest first.
    category: policy
    applies_to: list_failed_ci_runs
    trigger: A caller asks for the failed CI runs of a service
    logic: "IF the service exists THEN return its runs whose status is failed and whose key is not in rerunRuns, each with run key, run number, status and cause, ordered by run number from highest to lowest. IF there are none THEN return an empty list, which is not an error."
    violation: An unknown service returns UNKNOWN_SERVICE.
    source: FR2.1, FR6.1
  - id: BR2.3
    statement: Applying an upgrade sets the current version to the recommended version, and repeating it changes nothing.
    category: policy
    applies_to: apply_dependency_upgrade
    trigger: A caller applies an upgrade for a dependency of a service
    logic: "IF the dependency's current version already equals its recommended version THEN return result already-current and change nothing. OTHERWISE add its key to upgradedDependencies and return result applied with the new current version."
    violation: An unknown service returns UNKNOWN_SERVICE; a dependency key that does not exist or belongs to another service returns UNKNOWN_DEPENDENCY.
    source: FR3.4, FR6.1
  - id: BR2.4
    statement: Re-running a failed CI job makes the run leave the failed list, and repeating it changes nothing more.
    category: policy
    applies_to: rerun_ci_job
    trigger: A caller re-runs a CI run of a service
    logic: "IF the run exists THEN add its key to rerunRuns if it is not there and return result rerun-started. A run that is already re-run, or was never failed, returns the same result and changes nothing more."
    violation: An unknown service returns UNKNOWN_SERVICE; a run key that does not exist or belongs to another service returns UNKNOWN_RUN.
    source: FR3.4, FR6.1
  - id: BR2.5
    statement: Changes live in memory only; a restart loads the data again from the seed.
    category: constraint
    applies_to: RuntimeOverlay
    trigger: The server starts
    logic: IF the server starts THEN upgradedDependencies and rerunRuns are empty and the data set is loaded again from the seed.
    violation: Nothing written to disk is a defect only if a later start finds it; no such file is read.
    source: FR6.1, NFR7
  - id: BR2.6
    statement: Two calls at the same time give the same result as one after the other.
    category: constraint
    applies_to: apply_dependency_upgrade, rerun_ci_job
    trigger: Two write calls arrive together
    logic: "IF two write calls overlap THEN they take effect one at a time in the order received, so a pair of identical calls returns applied (or rerun-started) twice at most and leaves one change."
    violation: A lost or doubled change is a defect.
    source: FR6.1

  - id: BR3.1
    statement: With the failure setting on, every tool call fails and nothing changes.
    category: policy
    applies_to: list_upgrade_plan, list_failed_ci_runs, apply_dependency_upgrade, rerun_ci_job
    trigger: Any tool call
    logic: IF failureMode is on THEN return the error FORCED_FAILURE before any other check and change nothing; IF it is off THEN behave as the other rules say.
    violation: A successful call with the setting on is a defect.
    source: FR3.6
  - id: BR3.2
    statement: The failure setting, the seed and the port are read once at start; an invalid value stops the server.
    category: validation
    applies_to: ServerSettings
    trigger: The server starts
    logic: "IF GUARDRAILS_FAILURE_MODE is set to anything other than on or off, or GUARDRAILS_SEED is not a whole number, or PORT is not a whole number between 1 and 65535, THEN the server does not start and writes one line naming the setting and the expected form. IF a setting is not given THEN its default is used: failure mode off, the fixed default seed baked into the image; PORT has no default and is required."
    violation: A server that starts with an invalid setting is a defect. The settings are not changed while the server runs; a test switches the failure mode by restarting the container.
    source: FR6.1, FR7.2
  - id: BR3.3
    statement: A failed tool call returns a tool error with a code and a message.
    category: constraint
    applies_to: ToolError
    trigger: A tool call fails
    logic: "IF a call fails THEN the result is marked as an error, its structured content holds the code and message, and its text holds the same message. Checks run in this order: the failure setting (FORCED_FAILURE), the input form (INVALID_INPUT), the service (UNKNOWN_SERVICE), then the dependency or run key (UNKNOWN_DEPENDENCY or UNKNOWN_RUN). The first failed check decides the code. INTERNAL_ERROR applies only when no earlier check fits and a handler fails unexpectedly; its message is a fixed sentence, never caller text, and the server keeps running."
    violation: A different order or a code outside the list is a defect.
    source: FR6.1
  - id: BR3.4
    statement: A missing or empty required input is an input error; unknown extra input is ignored.
    category: validation
    applies_to: all tools
    trigger: A tool call arrives
    logic: IF a required input (service, dependencyKey or runKey) is missing or empty THEN return INVALID_INPUT. IF the call carries fields the tool does not define THEN ignore them.
    violation: Rejecting an unknown extra field is a defect.
    source: FR6.1

  - id: BR4.1
    statement: The health check answers ready only after the data is loaded.
    category: constraint
    applies_to: health endpoint
    trigger: A caller asks for the health check
    logic: IF the data set is loaded and the tools are available THEN answer OK with a small status body; OTHERWISE answer not ready.
    violation: An OK answer before the data is loaded is a defect.
    source: FR8.1
  - id: BR4.2
    statement: The server knows nothing about changes, approvals, users or the audit log.
    category: constraint
    applies_to: GuardrailsServer
    trigger: Any call
    logic: IF a call arrives THEN the server does what is asked and records nothing about who asked or why. Approval state lives in the plugin backend.
    violation: Any field, tool or store about approval, user or audit in the server is a defect.
    source: FR6.1
  - id: BR4.3
    statement: The seed data set is reachable only through the four tools.
    category: constraint
    applies_to: GuardrailsServer
    trigger: Any call
    logic: IF a caller wants the data THEN it asks one of the four tools; the server offers no file, endpoint or tool that returns the whole data set, apart from the health check.
    violation: Any other way to read the data is a defect (FR6.2 is checked on the plugin side in u2).
    source: FR6.2
```

## Summary

| Rule | Statement | Source |
|---|---|---|
| BR1.1 | Same seed, same bytes | FR7.2, NFR7 |
| BR1.2 | 4–6 services, 40–60 dependencies, 80–120 CI runs in total | FR7.1 |
| BR1.3 | Every set holds the cases the stories test | FR1.1, FR2.1, FR7.1 |
| BR1.4 | Invented, realistic, marked synthetic | FR7.1 |
| BR1.5 | Unique, readable, opaque keys | FR6.1 |
| BR1.6 | Recommended version never below current | FR1.1 |
| BR2.1 | Plan lists every dependency, empty list is not an error | FR1.1, FR6.1 |
| BR2.2 | Failed-runs list shows currently failed runs, newest first | FR2.1, FR6.1 |
| BR2.3 | Apply sets current to recommended; repeat is a no-op | FR3.4, FR6.1 |
| BR2.4 | Re-run removes the run from the failed list; repeat is a no-op | FR3.4, FR6.1 |
| BR2.5 | Changes in memory only | FR6.1, NFR7 |
| BR2.6 | Overlapping writes act one at a time | FR6.1 |
| BR3.1 | Failure setting on: every call fails, nothing changes | FR3.6 |
| BR3.2 | Settings read once; invalid value stops the server | FR6.1, FR7.2 |
| BR3.3 | Tool error has a code and message; fixed check order | FR6.1 |
| BR3.4 | Missing input is an error; extra input ignored | FR6.1 |
| BR4.1 | Ready only after load | FR8.1 |
| BR4.2 | No approval, user or audit knowledge | FR6.1 |
| BR4.3 | Data reachable only through the four tools | FR6.2 |
