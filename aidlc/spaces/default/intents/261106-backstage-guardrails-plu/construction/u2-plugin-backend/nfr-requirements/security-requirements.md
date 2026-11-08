# Security Requirements — u2-plugin-backend

Sources: `requirements.md` (NFR5 audit integrity, FR3.3, FR5.2, hosting-later constraint), `functional-spec.md` and `rules.md` (BR1.1–BR1.4, BR2.4, BR3.1–BR3.5, BR5.1–BR5.3, BR7.7, BR8.1), `contract-summary.md` (contracts C1 and C3, the sign-in section), `phases/construction.md` security guardrails (no hard-coded secrets, validate inputs at boundaries, flag any bypass of authentication) and answers Q1–Q2 in `nfr-requirements-questions.md`. Security requirements here extend NFR5 (audit integrity): this unit is where identity, roles, the no-self-approval rule and the audit log are enforced, so it carries the security of the whole sample.

## Deployment Shape

The backend runs inside the Backstage backend as a plugin, reachable only through the Backstage app. All data is invented; there is no personal data and no real secret except the database login, which comes from settings. The three demo users are fixed (BR1.2) and sign in without a password by design (contract C3). The backend, not the browser, decides who may do what.

## Requirements

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR5.1 | The actor and role of every request come only from the sign-in identity. | A request that carries an actor or role in its body, query or headers is served as the signed-in user and the extra values change nothing (BR1.1). A test sends a forged actor and role and sees the signed-in user in the change and in the audit entry. |
| NFR5.2 | A request without a valid demo identity is refused and writes nothing. | A call with no identity, or one that names no demo user, gets 401, and no change and no audit entry is written (BR1.3). A test covers a missing, a malformed and an unknown identity on every route. |
| NFR5.3 | The demo sign-in is off unless a setting turns it on. | The setting `guardrails.demoSignIn.enabled` defaults to off; with it off, the demo provider is not registered and no demo identity is accepted. The compose run turns it on. A test starts the backend with the setting off and finds no way in (accepted risk below). |
| NFR5.4 | Roles and the no-self-approval rule are enforced in the backend. | The auditor is refused on propose, approve, reject and retry; a proposer is refused on deciding their own change; both are recorded as refused with the reason as submitted (BR1.4, BR3.2, BR3.3). A test calls the routes directly, without the UI, as each user. |
| NFR5.5 | The audit log can only be appended to and read. | The audit component offers append and read only; no route and no store method updates or deletes an entry; the audit table has a database rule that blocks updates and deletes (BR5.1). A test tries to change and remove an entry through the store and the database and both fail. |
| NFR5.6 | Every input is checked at the boundary. | The service name, change id, kind, target, status, dates, page and page size are checked against known values and ranges; an invalid value gets 400 INVALID_INPUT and writes nothing; unknown fields are ignored and never interpreted. A reason of more than 2,000 characters is refused with INVALID_INPUT; a reason within the limit is stored exactly as submitted (BR5.3). A test sends empty, very long and markup-containing values and gets a defined error, never a crash. |
| NFR5.7 | Every database statement uses bound parameters. | No statement is built by joining user text into SQL; a test sends text with quote and statement characters in the service name, reason and filters and gets them stored or filtered as plain text. |
| NFR5.8 | No secret is in the code, the image or the log. | The database login and the server address come from settings only; the log line of a request holds time, route, actor id, status, error code and duration, and never a reason text, a setting value or a login (phase guardrail). A test reads the log of a full run and finds none of these. |
| NFR5.9 | An unexpected failure reveals nothing and writes nothing partial. | An unexpected error returns a plain 500 with a fixed message and no stack, query or setting; the decision order of BR3.4 leaves a claim that is released after 30 seconds (BR7.3) and an audit entry that is rebuilt (BR7.4). A test forces a failure after the claim and finds the change failed after release, with its entry. |
| NFR5.10 | Changes and audit entries survive a restart. | Both are stored in the database (BR8.1); a test restarts the backend against the same database and finds every change and entry. |

## Accepted Risk: Passwordless Demo Sign-In and Hosting Later

Anyone who can open the page can become any of the three demo users, including the platform engineer, without a password (answer Q2: A). That is the purpose of the demo, and the backend still enforces roles, the no-self-approval rule and the audit log. The risk is contained by NFR5.3: the demo sign-in is off by default and only the compose run turns it on, so a hosted run cannot get it by accident. Before any hosted use, a real Backstage sign-in provider must replace the demo provider; the backend already reads the actor from the sign-in identity (NFR5.1), so only the provider changes. This risk is recorded here so the hosting-later rule in the team practices is met knowingly.

## Threat Considerations

| Threat | Why it is low here | Control |
|---|---|---|
| A caller claims to be another user or role in the request | The backend ignores any actor or role in the request | NFR5.1 |
| A caller without an identity reaches the routes | Every route needs a demo identity | NFR5.2 |
| The demo sign-in is reachable on a hosted copy | Off by default, switched on by the compose run only | NFR5.3; accepted risk above |
| The auditor, or a proposer, decides a change | Backend enforces role and proposer rules, not only the UI | NFR5.4 |
| An entry is edited or removed to hide an action | No route or method for it; the database blocks it | NFR5.5 |
| Hostile text breaks a query or the log | Bound parameters; checked inputs; no reason text in the log | NFR5.6, NFR5.7, NFR5.8 |
| Two callers decide the same change at once | One atomic conditional update; exactly one wins | NFR1.7 (tech-stack-decisions.md); BR3.4 |
| A crash after a write leaves a change without its entry | Claim release and entry rebuild | NFR5.9 |

## Notes for Later Stages

- The setting `guardrails.demoSignIn.enabled` and the error code `INVALID_INPUT` (400) are additive changes to contracts C3 and C1; they are written into `contract-summary.md` in this unit's Code Generation with the other changes listed in `functional-spec.md`.
- NFR Design (next stage) turns these into patterns: where the identity is read, how the audit store is limited to append and read, and how the log line is built.
