# Practices Discovery — Questions

## Q1. [Release] How do you want to work with branches and merging?

Why we ask: it sets how changes reach the main line.

- A. One main branch (trunk); each piece of work is squash-merged into it as a single commit
- B. Short-lived feature branches merged through pull requests
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q2. [Release] Build a thin end-to-end slice first? A walking skeleton is a minimal version that runs the whole way through, built first to prove the pieces connect before the real features go in.

Why we ask: it changes the order the work is built in.

- A. Yes, build the thin slice first
- B. No, build piece by piece in the planned order
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q3. [Quality] How should tests be written relative to the code?

Why we ask: it sets the testing approach every build follows.

- A. After the code: build a layer, then write and run its tests
- B. Before the code (test-driven): write a failing test, then the code
- C. A mix: scenario-style tests first, lower-level unit tests after the code
- D. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q4. [Quality] What is the minimum test coverage for the plugin code?

Why we ask: the intent called for a stated coverage floor but not the number.

- A. 80% of lines
- B. 70% of lines
- C. 60% of lines
- D. Not yet defined
- X. Other (please specify)

[Answer]: X. 85% of lines

## Q5. [Release] How does the project get deployed?

Why we ask: the framework's default assumes staging and production environments, which may not apply to a local-only sample.

- A. Local only: docker compose (minikube optional), nothing deploys automatically
- B. Local, plus automatic deploy to a hosted staging environment on merge
- C. Not yet defined
- X. Other (please specify)

[Answer]: X. Local only, but with future ability to deploy to hosted environments

## Q6. [Developer] What formatting and linting rules apply?

Why we ask: it decides what CI checks on every change.

- A. Prettier and ESLint with Backstage's usual settings, enforced in CI
- B. Whatever the Backstage project generates, without extra enforcement
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Way of working: short-lived feature branches merged through pull requests (Q1: B)
- Walking skeleton: no, build piece by piece in the planned order (Q2: B)
- Testing: test-driven, write a failing test before the code (Q3: B)
- Coverage: at least 85% of lines on the plugin code (Q4: 85%)
- Deployment: local only, with the future ability to deploy to hosted environments (Q5)
- Code style: Prettier and ESLint with Backstage's usual settings, enforced in CI (Q6: A)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
