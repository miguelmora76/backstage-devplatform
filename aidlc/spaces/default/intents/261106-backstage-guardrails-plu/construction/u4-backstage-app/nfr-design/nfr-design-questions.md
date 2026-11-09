# NFR Design — u4-backstage-app — Questions

This stage turns the NFR Requirements of this unit into patterns. Already fixed by earlier stages, so not asked again: the new frontend and backend systems, Material UI 4 with React Testing Library, `msw` and `jest-axe`, the start-up test with Backstage's test backend, the 5 second limits on the sign-in page, the token in memory only, the committed catalog checked against the generator, the shipped settings with `${GUARDRAILS_SERVER_URL}` and the demo switch off by default, and the checks that u5 builds in the compose run.

Settled as design choices without asking (written into the design for you to correct):
- The sign-in page is driven by one small state function (loading, choosing, demo off, load failed, starting, sign-in failed, signed in) kept apart from the screen, so every state is tested without a browser and the page can never be blank.
- The user list and the start call each get a 5 second limit with an abort signal; a limit counts like a lost connection. A stale answer from an older load is dropped.
- A chosen user shows "working" in the same render and a second press is ignored, even inside one frame.
- The sign-in code keeps the token in one object per app instance and reads it only to answer the identity request; nothing else gets a getter, a log call or an address built from it.
- The user list is shown as text; a lint rule forbids raw-HTML insertion and `console` calls in `packages/app`.
- The backend's feature list is one exported list; the entry point and the start-up test both build from it, and the entry point exits with a non-zero code on any start-up failure.
- The shipped settings are checked by one function that the settings test and a CI script both call (substitutions, defaults, no literal secret, no foreign host name, CORS for the app's own address only).
- No module-level state in the app; a lint rule on top-level `let` and mutable exports keeps it that way.
- A script compares each package's declared dependencies with its `allowed-packages.txt` in CI.
- Logging stays with Backstage's logger; the start-up test records the lines and searches them for the token, the database password and the text of a reason.

## Q1. [Security] Which security headers should the app send?

Why we ask: u3's design left browser security headers (a content policy that blocks injected scripts, framing protection) to this unit. The choice decides what the settings test checks and whether a later hosted run is safe by default. Recommendation: A, because Backstage's own defaults already block framing and mixed content, the app has no raw-HTML insertion, and a hand-written policy often breaks the app's own scripts and needs trial and error in a real browser.

- A. Keep Backstage's default headers and add one explicit setting for the content policy that only allows the app's own address and the backend's address; the settings test checks it is present, the real-browser check in u5 confirms the pages still work
- B. Backstage's default headers only; no content policy setting of our own
- C. A strict content policy (no inline scripts, no `eval`) written now and tested in the start-up test against the backend's answer headers
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Security headers: Backstage's defaults plus one explicit content-policy setting for the app's and backend's own addresses, checked by the settings test and confirmed in u5's browser run (Q1: A)
- Design choices set without asking: sign-in page driven by one state function; 5 second limits with abort and stale-answer drop; working state plus ignored second press; token in one object with no getter; text-only rendering with lint bans on raw HTML and console; one exported feature list with a non-zero exit on start-up failure; one settings-check function shared by test and CI; no module-level state; per-package allow-list check; Backstage logger with a recorded-lines test for secrets

- Looks correct
- Request changes

[Answer]: Looks correct
