# Security Requirements — u3-plugin-ui

Sources: `requirements.md` (FR4.1, FR5.2, FR12.1, NFR5 audit integrity; constraint: design must not block hosting later), `functional-spec.md` and `rules.md` (BR4.3, BR5.2, BR5.3, BR3.5, BR3.6), `contract-summary.md` (C1: identity only from the sign-in credential, error codes; C3: the demo sign-in and its start route), the u2 security requirements (`NFR5.1` to `NFR5.10` of u2-plugin-backend, which enforce every rule on the server side), the phase rules for Construction (no secrets in code, validate input at boundaries, flag any bypass of authorization) and answer Q1 (the plugin holds the chosen demo user's token).

The backend enforces every rule; the browser can only show the backend's answer. These requirements keep the plugin from weakening that. Detailed IDs inherit NFR5 (audit integrity) and the phase security rules.

## Trust Boundaries

| Boundary | What crosses | Trusted? |
|---|---|---|
| Browser to plugin backend (C1) | Credential, proposals, reasons, filters, paging | The backend trusts only the credential's identity; everything else is input |
| Plugin backend to browser | Plan, CI causes, change summaries, failure messages, reasons, names | Text from the guardrails server and from other users is untrusted content |
| Browser to demo sign-in start address (C3) | A chosen userId, answered with a token | Passwordless by design; the accepted risk of u2 NFR5.3 |
| Browser storage | The chosen userId | Readable by any script on the page |

## Requirements

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR5.1 | The UI offers no way to edit, delete or add an audit entry. | A test that lists every control inside the audit section finds only filters, Clear filters and paging; no request other than a read is sent from it (BR4.3, FR4.1, NFR5). |
| NFR5.2 | The chosen user's token lives in memory only. The only value written to the browser's tab storage is the chosen userId, and when the token is missing or about to expire the plugin asks the start address for a new one. | A test switches user, then reads all browser storage and finds the userId and no token; after a simulated reload the plugin gets a fresh token before its first call, but only when the stored user is in the user list. On a first visit, or with the demo sign-in off, no user list is available: no switch is shown, no start address is called, and calls use the app's own credential; the backend answers a credential that is not a demo user with 401, and the person sees `error.unauthenticated`. |
| NFR5.3 | A token is never shown, logged, placed in an address or sent anywhere except the plugin backend. | A test greps the rendered page, the console output and every request address of a full walkthrough for the token and finds none; the credential appears only in the request header to the plugin backend's address. |
| NFR5.4 | No request carries an actor, a role or a user id other than the credential (BR5.3). The one exception is the Actor audit filter, which names whose entries to read, and the start address, which names whom to sign in as. | A test records every request of a full walkthrough and finds no `actor`, `role` or `userId` in any body, and in queries only the audit `actor` filter and the start address's `userId`. |
| NFR5.5 | Text from the backend or other users is shown as text, never as markup. This covers change summaries, causes, failure messages, reasons, names and targets. | A test feeds `<img src=x onerror=...>` and script-like strings into each of those fields and finds them shown literally and no element created. No use of raw-HTML insertion anywhere in the plugin (a lint rule makes it a failure). |
| NFR5.6 | Values placed in a request address are encoded: service name, change id, filter values. Filter values come from fixed lists or validated dates; a reason travels in the body only. | A test with service and change ids containing `/`, `?`, `#` and spaces sends them encoded and reaches the right route. |
| NFR5.7 | The reason is capped at 500 characters in the box and is sent exactly as typed; an empty or blank reason is not sent (BR3.2). | A test types 501 characters and finds 500 kept; a blank reason sends nothing. The backend repeats both checks. |
| NFR5.8 | The UI never decides an authorization rule: an action is enabled only when the backend lists it as allowed, and a disabled action sends nothing (BR3.5, BR2.4, FR12.1). | A test per disabled reason that is ever shown (server unreachable, auditor, proposer, in progress, already current) and one for an unknown reason activates the action and finds no request sent (NOT_PENDING and NOT_FAILED are never shown: the change status decides which actions appear, D11); a test with an action that the backend lists as allowed finds it sent. |
| NFR5.9 | The switch is shown only when the backend gives the demo user list, and only users from that list can be chosen. | With the list unavailable (demo sign-in off) no switch is rendered and no call goes to the start address; a userId not in the list is never sent. |
| NFR5.10 | Errors shown to the person are catalog texts, plus the guardrails server's failure message for a failed change. No stack traces, response bodies, status text from the server or internal ids appear on screen or in the console. | A test forces each error code of C1 and a thrown error, and finds only catalog text (and the failure message in the decision block) on screen, and no console output containing a response body. |
| NFR5.11 | No host name, port, user name, token or secret is written in the plugin's code. The only addresses in it are the relative routes of C1 and the relative start path of the demo sign-in (C3), which are contract text and not a place. The base addresses of the plugin backend and of the auth backend both come from Backstage's discovery service, and the plugin reads no settings of its own. | A search of the built plugin finds no host name, port or token; the plugin needs no app-config key (hosting-later check). |
| NFR5.12 | New packages are limited to the ones named in `tech-stack-decisions.md` and pinned in the lock file. | The lock-file diff of the pull request adds only those packages and their dependencies. |

## Accepted Risks

| Risk | Why accepted | Control |
|---|---|---|
| Passwordless demo sign-in: anyone who can open the page can become any demo user (u2 NFR5.3). | A demo needs no password; Q1 of Contract Design chose it. | The backend setting is off by default; this plugin shows the switch only when the backend offers the list. Replace the provider before any hosted use. |
| With the plugin holding the token (Q1: A), the rest of the Backstage app, for example its profile menu, can show a different user from the one the Guardrails pages act as. | Keeps the screen, focus and announcement of the mockups with no change to the app's sign-in. | The Guardrails header always shows the user the plugin acts as; the audit log shows the same user as actor (FR5.2). |
| A script running in the page can read the in-memory token and the stored userId. | It is a passwordless demo; the token is short-lived and never in storage, an address or any output. | The demo sign-in is off by default; replace the provider before any hosted use. |
| The chosen userId in tab storage can be changed by any script on the page. | It is only a name for a passwordless demo user. | The token is requested again from the start address, which accepts only the three known users (u2 NFR5.3). |

## Traceability

NFR5 (audit integrity) is met by NFR5.1 and by NFR5.4 to NFR5.8, which keep the browser from writing or altering anything the backend does not allow. NFR5.2, NFR5.3, NFR5.5, NFR5.6, NFR5.9, NFR5.10, NFR5.11 and NFR5.12 are the phase security rules for this unit (credentials, output and input handling, no secrets, bounded dependencies).
