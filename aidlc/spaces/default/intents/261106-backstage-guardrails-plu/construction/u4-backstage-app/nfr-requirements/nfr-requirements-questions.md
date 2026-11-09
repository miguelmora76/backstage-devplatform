# NFR Requirements Questions — u4-backstage-app

Context: u4 holds wiring and configuration only, so most of the project's NFRs apply to it lightly. NFR1 (each view within 5 seconds) is met by the plugins and measured by u5 on the compose run; NFR2 (85% line coverage, tests first) and NFR6 (Prettier and ESLint) apply to the app's own code; NFR3 (WCAG 2.1 AA) applies to the one screen u4 owns, the sign-in page; NFR4 (current Chrome and Firefox) applies to the app as a whole and is checked by u5; NFR5 (audit integrity) belongs to u2, and u4 only has to make sure nobody who is not a demo user is signed in; NFR7 (repeatability) applies to the catalog, which must come from the same seed every time.

Settled without asking (written into the documents for you to correct):
- The same toolchain as the plugins: TypeScript, Jest through Backstage's test runner, React Testing Library, `msw` and `jest-axe` for the sign-in page; Prettier and ESLint with Backstage's settings; the Backstage package versions already in the workspace.
- The sign-in page is scanned for accessibility in a simulated browser on every pull request (loading, choosing, demo off, load failed, sign-in failed); the real-browser scan and the Chrome and Firefox check run in u5, as agreed for u3.
- No time target of its own for start-up: the compose run waits for the readiness route, and the 5-second view target (NFR1) is measured by u5 once the app is up.
- No secret in a committed file and no address in code (BR4.4, BR4.5); the sign-in token is held in memory only and never stored, logged or placed in an address.
- The catalog is deterministic: the same seed gives the same file, checked by a test.

## Q1. [Quality] Should this unit prove, in its own tests, that the real pieces start together?

Why we ask: the plugins are tested alone against stand-ins. The first time the real backend plugin, its demo sign-in module and the settings run together is in this app, and a mistake in the wiring (a missing module, a wrong setting key, a provider that is never created) would only show up in the compose run of u5, which needs Docker and is slow. A start-up test can use Backstage's test backend with the real plugin and the real demo sign-in module, in-memory SQLite and a stand-in guardrails server, and no Docker. It would check that the app answers its readiness route, that the user list is open when the demo sign-in is on and absent when it is off, that the start address answers a token for each demo user and refuses an unknown one, and that a call from someone who is not a demo user is refused with 401. Recommendation: A, because it is the one place the wiring can be proven cheaply on every pull request.

- A. Yes. A start-up test with the real backend plugin and demo sign-in module runs in this unit's tests on every pull request (no Docker)
- B. No. The wiring is checked only by u5's compose run
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- A start-up test with the real backend plugin and demo sign-in module (in-memory SQLite, a stand-in guardrails server, no Docker) runs in this unit's tests on every pull request (Q1: A)
- Settled without asking: the same toolchain as the plugins; the sign-in page scanned for accessibility in a simulated browser on every pull request, with the real-browser scan and the Chrome and Firefox check in u5; no start-up time target of its own; no secret in a committed file and no address in code, with the sign-in token in memory only; a deterministic catalog checked by a test

- Looks correct
- Request changes

[Answer]: Looks correct
