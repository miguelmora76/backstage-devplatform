# NFR Design — u2-plugin-backend — Questions

This stage turns the NFR Requirements of this unit into patterns. Already fixed by earlier stages, so not asked again: the decision order of BR3.4, the 3 and 10 second timeouts with no automatic retry, the 30 second claim release, the 5 second reuse of the health probe, PostgreSQL with an atomic conditional update, append-only audit, the demo sign-in off by default, tests against a real PostgreSQL for the rule tests (NFR2.9), and one log line per request.

Settled as design choices without asking (written into the design for you to correct, and they also answer the minor points the review of the requirements raised):
- The check order for a write is: identity, input shape (including a reason of more than 2,000 characters and a page size outside 1 to 100, which get 400 INVALID_INPUT and write nothing), existence, empty reason, role and proposer refusals (recorded), reachability, then the repair, claim, server call, final write and audit entry of BR3.4.
- Only a user principal that names one of the three demo users is accepted; service principals and other users are refused with 401.
- The audit table blocks updates and deletes with a trigger that raises an error (so an attempt fails loudly); this guards the application paths, not the database owner.
- A claim is released by the first read or decision after 30 seconds, not by a timer; release tests use a clock the test controls.
- Concurrent reads share one health probe; the 200 ms target of NFR1.3 is measured with the probe result already cached.
- The shipped settings keep the demo sign-in off, and the backend logs a warning line at start-up when it is on; u4 and u5 must keep the shipped default off and set it on only in the compose override.
- PostgreSQL for local test runs is started by a documented compose service, so the tests need no manual setup beyond docker.

## Q1. [Security] Should the list of demo users be readable before anyone has signed in?

Why we ask: the sign-in screen has to show the three users before there is an identity, so the list of users (name and role only) cannot always require a sign-in. The list holds only the three invented users. Recommendation: A, because the sign-in screen then needs nothing built into the browser, and the list reveals nothing that is not already on the screen.

- A. Yes. The list of demo users is the one route that needs no sign-in, it is read only, and it exists only while the demo sign-in is on; every other route needs a demo identity
- B. No. Every route needs a demo identity, and the three users are built into the sign-in screen of the user interface
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- The list of demo users (name and role only) is the one route that needs no sign-in; it is read only and exists only while the demo sign-in is on; every other route needs a demo identity (Q1: A)
- Design choices set without asking: write check order (identity, input shape including a reason over 2,000 characters and a page size outside 1 to 100 as 400 INVALID_INPUT, existence, empty reason, recorded role and proposer refusals, reachability, then BR3.4); only user principals naming a demo user are accepted; audit table blocks update and delete with an error-raising trigger; claims released by the first read or decision after 30 seconds with a controllable clock in tests; concurrent reads share one health probe; shipped default for the demo sign-in stays off with a start-up warning when on, a dependency for u4 and u5; local test PostgreSQL started by a documented compose service

- Looks correct
- Request changes

[Answer]: Looks correct
