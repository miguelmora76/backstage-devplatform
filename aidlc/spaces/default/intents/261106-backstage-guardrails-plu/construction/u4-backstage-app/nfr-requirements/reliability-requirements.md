# Reliability Requirements — u4-backstage-app

Sources: `requirements.md` (NFR7 repeatability; FR11.2 behavior when the guardrails server is down, delivered by u3 and u2), `functional-spec.md` and `rules.md` (BR3.1, BR3.2, BR3.5, BR4.1, BR5.1), `contract-summary.md` (C4 readiness route) and answer Q1 in `nfr-requirements-questions.md`. Requirement IDs extend NFR7, the only inception reliability-type requirement; the sample has no availability promise.

## Availability

No availability target (SLA or SLO) applies: the app runs on a developer laptop for a demo and has no uptime promise. What matters is that it starts the same way every time, fails loudly when it cannot start, and stays up when the guardrails server is down.

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR7.1 | The catalog is the same on every run and every machine. | The catalog script run twice with the default seed gives identical output, byte for byte, and the committed file equals it (BR3.2); the test also runs in CI. |
| NFR7.2 | A bad start is loud. | With `GUARDRAILS_SERVER_URL` missing, the start-up test finds the backend start fails with the guardrails plugin's message naming `guardrails.server.url` (BR4.1). That the real process then exits with a code other than 0, so compose shows the failure, cannot be seen in the test backend: Code Generation runs the real backend entry point once with the variable missing, records the exit code in the code summary, and makes the entry point exit non-zero itself if Backstage does not. |
| NFR7.3 | The app starts and stays up when the guardrails server is down. | The start-up test with a stand-in server that is not running finds the readiness route answers 200 and the plugin's open list and audit routes still work; the server-dependent routes answer their 503 (u2 FR11.2). The app never waits for the guardrails server to be ready. |
| NFR7.4 | The readiness route tells the truth. | It answers 200 only after the backend and the guardrails plugin (with its migrations) have started; before that it does not answer 200 (BR5.1). The start-up test requests it after start and finds 200. |
| NFR7.5 | The sign-in page always shows one defined state. | In every state of the sign-in page (loading, choosing, demo off after a 401 or 404, load failed after no answer in 5 seconds or a server error, starting, sign-in failed) a test finds either choices, one text, or a working state, never a blank page (BR2.2, BR2.3). |
| NFR7.6 | The same seed and the same settings give the same app. | No random or clock-dependent text on the sign-in page; the sign-in page and the catalog read only the user list and the committed file (BR3.1). |

## Fault Tolerance and Recovery

- The app keeps no data of its own worth backing up: the catalog is a committed file, and the plugins' data is in their database (u2; the compose volume keeps it across restarts).
- A failed sign-in attempt leaves the page usable: the person can try again (BR2.3). A user list that cannot be read has Retry (BR2.2).
- A reload or an expired sign-in token returns the person to the sign-in page or to u3's session-ended text; there is no silent renewal (BR2.6).

## Graceful Degradation

With the guardrails server down, the app, its catalog and sign-in work; the plugin pages show their own unreachable states (u3). With the demo sign-in off, the app starts and shows `signin.off`.
