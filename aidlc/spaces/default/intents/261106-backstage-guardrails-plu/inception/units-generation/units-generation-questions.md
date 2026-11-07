# Units Generation — Questions

A unit is a piece of work that can be built and tested on its own. The six building blocks from Domain Design are: GuardrailsPluginUI, ChangeWorkflow, AuditLog, DemoIdentity, GuardrailsServer and SeedDataGenerator. The run and delivery stories (one-command run, minikube run, CI) also need a home. This stage does not decide the build order; Delivery Planning does.

## Q1. [Architecture] How should the building blocks and the run-and-delivery work be grouped into units?

Why we ask: more, smaller units can be built and tested in parallel; fewer, larger units mean less hand-off between them. Recommendation: B, because the plugin backend's three blocks share one Backstage backend and are tested together, while the server and the UI each stand alone.

- A. Fine, 9 units: seed data generator; guardrails server; demo identity; audit log; change workflow; plugin UI; compose run; CI; minikube run
- B. Grouped, 6 units: data and server (generator plus guardrails server); plugin backend (change workflow, audit log, demo identity); plugin UI; Backstage host app wiring; compose run and CI; minikube run
- C. Grouped but with delivery split, 7 units: as B, but compose run and CI are separate units
- D. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q2. [Delivery] May units with no dependency between them be built at the same time?

Why we ask: it decides whether the dependency graph is drawn to allow parallel work. Delivery Planning still chooses the actual order.

- A. Yes: keep only real dependencies, so independent units can be built in parallel, each in its own copy of the project
- B. No: link units in a single line so they are built one after another
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Six units: data and server (seed generator plus guardrails server); plugin backend (change workflow, audit log, demo identity); plugin UI; Backstage host app wiring; compose run and CI; minikube run (Q1: B)
- Only real dependencies are kept, so units with no dependency between them can be built at the same time; Delivery Planning still chooses the order (Q2: A)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
