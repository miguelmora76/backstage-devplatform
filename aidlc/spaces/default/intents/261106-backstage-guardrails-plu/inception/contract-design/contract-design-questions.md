# Contract Design — Questions

A contract is the agreement across a boundary between two units: what crosses it, in what shape, how it fails. The six units are u1-data-and-server, u2-plugin-backend, u3-plugin-ui, u4-backstage-app, u5-compose-and-ci and u6-minikube-run. Three boundaries need a contract:

- u3-plugin-ui calls u2-plugin-backend (the backend interface).
- u2-plugin-backend calls u1-data-and-server (the server's tool interface, four operations).
- u4-backstage-app wires u2 and u3 together (plugin registration, sign-in with demo users, the server address as a setting).

No unit is consumed from outside the system, so there is no public API beyond these.

## Q1. [Product] Should the contracts include the five changes first raised in the refined mockups?

Why we ask: the refined mockups raised five changes that the approved requirements and stories do not yet contain: (P1) an auditor role that cannot write (proposed FR12.1); (P2) a proposal is itself an audit entry with outcome "proposed"; (P3) the audit log is read per service; (P4) "open changes" means pending plus failed; (P5) the backend takes actor and role from the sign-in identity, never from the request. The backend interface cannot be fixed without deciding this. Recommendation: A.

- A. Yes: the contracts include all five, each marked with its origin (refined mockups), and the requirements and stories are updated in a separate step afterwards
- B. Yes, but go back and update the requirements and stories first, before writing the contracts
- C. No: the contracts follow only the approved requirements; the five stay as open questions
- D. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q2. [Product] When the guardrails server is down, which views show the error?

Why we ask: the requirement says a view that cannot reach the server shows an error with retry (FR11.2), and the refined mockup shows that error in the audit section too. But the audit log and the change records are kept by the plugin backend itself and do not need the server. The answer decides whether the backend interface has one failure case or two. Recommendation: A.

- A. Only the upgrade plan and the CI failures show the error. The audit table and the change list keep working, and all write actions are disabled with the reason "server unreachable". The mockup's audit error is removed.
- B. Every view shows the error, including the audit table, as in the mockup; the backend checks the server on every read
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q3. [Architecture] How does the plugin backend talk to the guardrails server?

Why we ask: the real guardrails server is an MCP server (a server that offers "tools" to a client), and the sample stands in for it in its own container. The mechanism decides the shape of the four operations. Recommendation: A, because the stand-in then behaves like the real thing.

- A. MCP over streamable HTTP: the backend is an MCP client and calls the four tools by name
- B. Plain REST/JSON endpoints, one per operation, with the same names and fields as the tools
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q4. [Architecture] What shape does the plugin backend's interface for the UI take?

Why we ask: the UI needs the upgrade plan, CI failures, open changes and audit entries, and for every row the actions allowed to the signed-in user with a reason when one is not allowed (decided in Domain Design). Recommendation: A.

- A. REST/JSON resources on the plugin's own path, one per view (plan, CI runs, changes, audit entries) and one per action (propose, approve, reject, retry); every list item carries its allowed actions
- B. The same resources, plus one summary request per service that returns plan, CI failures, open changes and the latest audit entries together for the overview card
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q5. [Architecture] How does the demo-user switch work?

Why we ask: the demo sign-in owns three users (Sam, Priya, Alex). The UI has a switch, and the backend must read the acting user and role from the sign-in identity (decision ADR-003), so the switch has to change that identity. Recommendation: A.

- A. A custom Backstage sign-in provider for the demo: the switch signs the browser in as the chosen demo user without a password, and the page reloads its data; the backend looks the role up from the demo user list
- B. Sign out, then sign in again on the Backstage sign-in page as another demo user
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q6. [Architecture] Who owns each contract, and how do the stand-ins stay true to it?

Why we ask: u2 and u3 are built and tested against stand-ins for the interface they call, with no edge between the units (accepted risk from Units Generation). If the stand-in drifts from the real interface, the pieces will not fit when u4 joins them. Recommendation: A.

- A. The provider owns the spec: u1 owns the server's tool interface and u2 owns the backend interface. The specs live in the provider unit's directory, and each consumer's stand-in is checked against the spec in the consumer's tests
- B. The specs live in one shared contracts directory that belongs to no unit; every unit's tests read from it
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q7. [Architecture] What is the versioning and breaking-change policy?

Why we ask: this is a one-person sample run locally, but the team wants to keep the option of hosting it later. Recommendation: A.

- A. No version numbers in the interfaces. Changes may only add (consumers ignore unknown fields). A breaking change is made by changing provider, consumer and spec in the same pull request
- B. A version in the path of the backend interface and in the tool names (for example v1), and a breaking change adds v2 beside it
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q8. [Operations] What are the timeouts and retries at the plugin backend to guardrails server boundary?

Why we ask: views must render within 5 seconds at the 95th percentile (NFR1), and a decision that has not finished within 30 seconds is released to failed with the message "Interrupted" (Domain Design). Recommendation: A.

- A. Reads: 3 second timeout, no automatic retry (the user presses retry). Writes (apply, re-run): 10 second timeout, no automatic retry; a timeout counts as a failed apply, and the user retries from the failed change
- B. Reads: 3 second timeout and one automatic retry. Writes: as A
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- The contracts include the five changes from the refined mockups (auditor role, audited proposals, per-service audit log, open changes = pending plus failed, actor and role from the sign-in identity), each marked with its origin; requirements and stories are updated in a separate step afterwards (Q1: A)
- Only the upgrade plan and CI failures show the error when the guardrails server is down; the audit table and change list keep working and writes are disabled with the reason "server unreachable"; the mockup's audit error is removed (Q2: A)
- The plugin backend calls the guardrails server as an MCP client over streamable HTTP (Q3: A)
- The backend interface is REST/JSON with one resource per view and one per action; every list item carries its allowed actions (Q4: A)
- The demo-user switch is a custom demo sign-in provider that signs in as the chosen user without a password; the backend looks the role up from the demo user list (Q5: A)
- The provider unit owns each spec (u1 the server's tool interface, u2 the backend interface) and each consumer's tests check its stand-in against the spec (Q6: A)
- No version numbers; changes only add; a breaking change changes provider, consumer and spec in the same pull request (Q7: A)
- Reads time out after 3 seconds with no automatic retry; writes time out after 10 seconds with no automatic retry, and a timeout counts as a failed apply (Q8: A)

- Looks correct
- Request changes

[Answer]: Looks correct
