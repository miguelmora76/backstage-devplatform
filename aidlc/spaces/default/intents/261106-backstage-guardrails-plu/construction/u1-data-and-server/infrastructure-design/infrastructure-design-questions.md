# Infrastructure Design — u1-data-and-server — Questions

The infrastructure here is one container on a developer laptop, started by docker compose (team practices: local only, hosting later possible). The five choices below are small details; on your instruction to settle those yourself (message 633d038b) they were answered with the recommended option and are listed for you to correct at the summary confirmation.

## Q1. [Operations] How is the server deployed?

- A. As a container image built from a Dockerfile in this unit, run by docker compose with no published port; the compose entry itself is written in u5-compose-and-ci
- B. As a plain Node.js process started by hand
- X. Other (please specify)

[Answer]: A

## Q2. [Operations] What base image and sizing?

- A. A small, official Node.js image of the pinned long-term-support release, multi-stage build, non-root user; limits of 256 MB and one core set in the compose entry (u5)
- B. A full Node.js image with no limits
- X. Other (please specify)

[Answer]: A

## Q3. [Security] How are secrets and settings handled?

- A. There are no secrets; the three settings (seed, failure mode, port) are environment variables with defaults, passed by compose
- B. A settings file mounted into the container
- X. Other (please specify)

[Answer]: A

## Q4. [Delivery] What does the pipeline do for this unit?

- A. On every pull request: format check, lint, type check, tests with the 85% coverage floor, the byte-for-byte repeatability check, the contract check of the stand-in against the C2 spec, and a build of the image (not pushed). No deployment step and no rollback procedure beyond reverting the pull request, because nothing deploys automatically
- B. The same, plus pushing the image to a registry
- X. Other (please specify)

[Answer]: A

## Q5. [Operations] What monitoring is built?

- A. The log line per call and the health route only; no metrics, alerts or dashboards. The compose health check uses the health route
- B. Add a metrics endpoint and a dashboard
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Deployment: a container image built from a Dockerfile in this unit, run by docker compose with no published port; the compose entry is written in u5 (Q1: A)
- Image: small official Node.js image of the pinned long-term-support release, multi-stage, non-root; 256 MB and one core limits set in compose (Q2: A)
- No secrets; seed, failure mode and port are environment variables with defaults (Q3: A)
- Pipeline on every pull request: format, lint, type check, tests with the 85% coverage floor, repeatability check, contract check, image build (not pushed); no deployment or rollback step (Q4: A)
- Monitoring: the call log and the health route only (Q5: A)

- Looks correct
- Request changes

[Answer]: Looks correct
