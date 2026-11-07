# Functional Design — u1-data-and-server — Questions

This unit is the synthetic guardrails server and the seed data generator. It covers stories US6.1 (server and repeatable data), US1.1 (upgrade plan), US1.2 (failed CI runs) and US3.3 (retry) from the server's side. The contract with the plugin backend (four tools, timeouts, error codes) is fixed in Contract Design (`contract-summary.md`, C2); these questions only settle behavior the contract leaves open.

Settled without asking, from earlier stages and the corner checklist (written into the spec as assumptions you can correct): the server is single-user and local; the plan lists every dependency, including ones already at the recommended version; applying an upgrade sets the dependency's current version to its recommended version and a repeat apply is a harmless no-op; applied upgrades and re-runs live in memory and are lost on restart; a missing or invalid start-up setting stops the server with a message naming the setting; the tool error code travels in the tool result's structured content as well as in its text; tools never retry on their own.

## Q1. [Product] What should re-running a failed CI job do in the demo?

Why we ask: the plugin's "Propose re-run" ends in a re-run call, and after approval the demo should show an effect. The contract only says the result is "rerun-started". Calling re-run twice for the same run (for example after a timeout and a retry) must also be safe. Recommendation: A.

- A. The run leaves the failed list (it counts as re-run and passing) until the server restarts; a second re-run of the same run returns the same result and changes nothing more
- B. The request is recorded but the run stays in the failed list, so nothing visibly changes
- C. Some runs pass on re-run and others fail again, decided by the seed (for example a flaky timeout passes, a real test failure does not)
- D. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q2. [Product] Which cases must the seeded data always contain?

Why we ask: the stories test empty states (a service with no dependencies, a service with no failed runs), several dependencies at different distances from the recommended version, and different failure causes. With purely random data those cases might not appear. Recommendation: A.

- A. Always contain: one service with no dependencies, one service with no failed CI runs, at least two dependencies already at the recommended version, and at least four different failure causes; the other values come from the seed. Counts stay within the 20% limits (about 5 services, about 10 dependencies and 20 CI runs each)
- B. Purely from the seed with the same distribution for every service, so empty states are tested by a separate small data set
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q3. [Product] How realistic should the names and versions in the data look?

Why we ask: the sample is a demo, and the data is what people look at. Recommendation: A.

- A. Realistic: services like checkout-api or billing-worker, dependencies named like well-known open source packages with plausible version numbers, and CI failure causes in everyday words (failing test, lint error, dependency conflict, flaky timeout, build cache). All of it is invented and marked synthetic in the data
- B. Plainly artificial: service-1, lib-a 1.0.0 and so on, so nobody mistakes it for real data
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Re-running a failed CI job makes the run leave the failed list (counts as re-run and passing) until the server restarts; a second re-run of the same run returns the same result and changes nothing more (Q1: A)
- The seeded data always contains one service with no dependencies, one with no failed CI runs, at least two dependencies already at the recommended version and at least four failure causes; the other values come from the seed and counts stay within the 20% limits (Q2: A)
- Names, versions and causes look realistic (invented, marked synthetic in the data) (Q3: A)

- Looks correct
- Request changes

[Answer]: Looks correct
