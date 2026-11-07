# NFR Design — u1-data-and-server — Questions

The design follows from the NFR Requirements answers (TypeScript on Node.js, one log line per call, no caller check). Three choices are left. The design documents in this folder already assume the recommended answer for each; a different answer means they are revised before review.

## Q1. [Architecture] How should the 10-times-larger data set check (NFR1.5) fit with the rule that every data set has about 5 services (BR1.2)?

Why we ask: the NFR Requirements review found that the large-data check contradicts the size limits. Recommendation: A.

- A. Keep the check as a test-only exception: the generator library accepts a size factor that only tests pass; it is not a setting and no tool can reach it
- B. Drop the large-data check and keep the size limits without exception
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q2. [Security] Should the optional caller check for hosting later be built now?

Why we ask: the server does not check callers (decided earlier). The design describes how an optional shared token would be added later. Recommendation: A, to keep the sample small.

- A. Document the design only; build nothing now
- B. Build the optional token setting now, off by default, on both the server and the plugin backend
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q3. [Operations] How should an unexpected error inside a tool be reported?

Why we ask: the contract lists four error codes plus INVALID_INPUT, but a bug or a failure we did not foresee needs a code too. Recommendation: A.

- A. Add the code INTERNAL_ERROR (an additive change to contract C2) with a fixed message; the server keeps running
- B. Report it as FORCED_FAILURE so no new code is needed
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- The 10-times-larger data set check stays as a test-only exception: a size factor on the generator library that only tests pass, not a setting and not reachable from any tool (Q1: A)
- The caller check for hosting later is documented only; nothing is built now (Q2: A)
- An unexpected error inside a tool is reported with a new additive code INTERNAL_ERROR and a fixed message; the server keeps running (Q3: A)

- Looks correct
- Request changes

[Answer]: Looks correct
