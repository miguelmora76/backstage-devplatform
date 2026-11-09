# Security Requirements — u4-backstage-app

Sources: `requirements.md` (FR5.1, FR5.2, NFR5 audit integrity), `functional-spec.md` and `rules.md` (BR1.1, BR1.2, BR2.1 to BR2.6, BR4.1 to BR4.5), `contract-summary.md` (C3 sign-in and settings), the u2 security requirements (which enforce every rule on the server), the u3 security requirements (the plugin's token handling), the phase rules for Construction (no secrets in code, validate input at boundaries, flag any bypass of authorization) and answer Q1 in `nfr-requirements-questions.md`. Requirement IDs extend NFR5.

The backend enforces every rule. The app's security job is to sign in only the three demo users, never to widen who can sign in, and never to put a secret or an address where it should not be.

## Trust Boundaries

| Boundary | What crosses | Trusted? |
|---|---|---|
| Browser to the sign-in start address (C3) | A chosen userId; the answer holds the token and identity | Passwordless by design; the accepted risk of u2 NFR5.3 |
| Browser to the user list (open route) | Names and roles of the three demo users | Public by design while the demo sign-in is on |
| Settings and environment | Server address, demo switch, database login | The environment is trusted; files in the repository must hold no secret |
| Committed catalog and settings files | Entity names, base addresses of local development | Reviewed in the pull request |

## Requirements

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR5.1 | Only the three demo users can be signed in to the app, and there is no other way to sign in. | A settings test finds `demo` as the only entry under `auth.providers` in the shipped settings, and the backend's feature list (NFR2.3) holds no other sign-in module; the real `demo` provider handler answers a token for sam, priya and alex and refuses an unknown userId with 401 (checked against u2's own module, as u3 does); the start-up test, with credentials built for a service principal, an unknown user and no one, finds the guardrails plugin refuses each with 401 (BR2.4). |
| NFR5.2 | The demo sign-in is off unless the environment turns it on. | A test reads the shipped settings and finds `guardrails.demoSignIn.enabled` filled from `GUARDRAILS_DEMO_SIGN_IN` with the default false. The start-up test with the switch off finds that a signed-out `GET /demo-users` answers 401 and a signed-in one 404 (u2 registers neither the open route nor the list), and no demo provider is registered; with the switch on it answers 200 with the three users to a signed-out caller (BR2.1, BR4.2). The sign-in page shows `signin.off` for the 401 and 404 answers. Whether the auth backend also needs an `auth.providers.demo` entry for the provider to exist is confirmed in Code Generation (D8); until then these checks are stated for the provider module, not for the auth plugin's own configuration. |
| NFR5.3 | The sign-in token lives in memory only: never in browser storage, an address, a log line or the page text. | A test signs in, then reads all browser storage and finds no token; searches the rendered page, the console output and every request address and finds none; the token appears only in the header of calls to the plugin backend (BR2.6). |
| NFR5.4 | No secret is written in a committed file, and no guardrails server address is written in code or in a committed settings file. | A test reads every committed settings file of the app and finds the server address only as the `${GUARDRAILS_SERVER_URL}` substitution, no password key with a literal value, and no host name other than the app's own local-development addresses; a search of the source finds no host name or port (BR4.1, BR4.4, BR4.5). |
| NFR5.5 | Names and roles from the backend are shown as text, never as markup. | A test feeds `<img src=x onerror=...>` and script-like strings as the names and roles of the user list and finds them shown literally and no element created. No raw-HTML insertion anywhere in the app's code (a lint rule makes it a failure). |
| NFR5.6 | The backend accepts browser calls only from the app's own address. | The shipped settings hold `backend.cors` for the app's base address only (no wildcard), confirmed by a settings test; the start-up test also sends a request with the `Origin` of another site and finds no `Access-Control-Allow-Origin` header for it. If the test backend turns out not to apply the CORS setting, Code Generation records that, and the origin check moves to u5's compose run (BR4.5). |
| NFR5.7 | The sign-in page offers choices only from the backend's user list, and the userId sent is one of them. | A test finds that no id outside the list can be sent, and that the page has no free-text field for a user id (BR2.3). |
| NFR5.8 | The app's dependencies are limited to the packages named in `tech-stack-decisions.md`. | A script compares the declared dependencies of `packages/app` and `packages/backend` with an allow-list kept beside them and fails on any other package, in CI. |

## Accepted Risks

| Risk | Why accepted | Control |
|---|---|---|
| Passwordless demo sign-in: anyone who can open the page can become any demo user (u2 NFR5.3). | A demo needs no password; Q1 of Contract Design chose it. | Off by default; on only in the compose override; the README states the risk and that the provider must be replaced before any hosted use. |
| A script running in the page can read the in-memory token. | A passwordless demo; the token is short-lived and never stored. | Token never in storage, an address or output (NFR5.3). |
| The user list is readable by anyone who can reach the backend while the demo sign-in is on. | It holds three invented users. | Present only while the switch is on. |

## Traceability

NFR5 (audit integrity) is met on the app's side by NFR5.1, NFR5.2 and NFR5.7, which keep the sign-in to the three demo users so that every acted-on entry names a real demo actor (u2 writes the entries). NFR5.3 to NFR5.6 and NFR5.8 are the phase security rules for this unit (credentials, secrets and addresses, output handling, origin, bounded dependencies).
