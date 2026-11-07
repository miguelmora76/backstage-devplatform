# Security Requirements — u1-data-and-server

Sources: `requirements.md` (NFR5 audit integrity, constraint on hosting later), `functional-spec.md` and `rules.md` (BR3.2, BR3.3, BR3.4, BR4.2, BR4.3), `contract-summary.md` (contract C2 and C4: the server, its settings and its health check), `phases/construction.md` security guardrails (no hard-coded secrets, validate inputs at boundaries) and answers Q1–Q3 in `nfr-requirements-questions.md`. Security requirements here extend NFR5 (integrity), because the server has no users, no personal data and no audit log of its own.

## Deployment Shape

The server is a single-user, local, synthetic-data service. All data is invented (BR1.4). It holds no personal data, no secrets and no approval state (BR4.2). In the compose run it is reachable only by the Backstage app.

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR5.1 | The data can be read only through the four tools. | No other endpoint, file or tool returns the data set; apart from the health check, a request to any other path is refused (BR4.3). A test calls an unlisted path and tool and gets a refusal. |
| NFR5.2 | The only writes are the two named in the contract, and they change memory only. | The server writes nothing to disk and changes only the in-memory overlay on apply and re-run (BR2.3, BR2.4, BR2.5). A test finds no file written during a full run. |
| NFR5.3 | Every input is checked at the boundary. | A missing or empty service, dependency key or run key returns INVALID_INPUT; an unknown key returns its UNKNOWN code; extra fields are ignored and never interpreted (BR3.3, BR3.4). A test sends empty, very long, and markup-containing values and gets a defined error, never a crash. |
| NFR5.4 | Start-up settings are validated and never echoed unsafely. | An invalid seed, failure setting or port stops the server with one line naming the setting and the expected form (BR3.2); the line contains no other setting value. |
| NFR5.5 | The compose run does not publish the server's port to the host machine. | In the compose file the server has no published port, and the Backstage app reaches it by service name. Checked in u5-compose-and-ci. |
| NFR5.6 | The container runs without extra privileges. | The image runs as a non-root user, has no shell tools beyond what the runtime needs, and exposes one port. |
| NFR5.7 | No secret is stored or required. | The server needs no key, token or password and none appears in the image, the settings or the log (phase guardrail: never hard-code credentials). |

## Accepted Risk: Hosting Later

The server does not check who is calling it (answer Q3: A). While the port stays unpublished this is safe for the local sample. If the sample is ever hosted, anyone who can reach the port could call the apply and re-run tools. Before any hosted use, a caller check (for example a shared secret sent by the plugin backend and checked by the server) must be added; adding it later is an additive change to contract C2 and does not break callers that send the token. This risk is recorded here so the hosting-later rule in the team practices is met knowingly.

## Threat Considerations

| Threat | Why it is low here | Control |
|---|---|---|
| A caller on the same network applies upgrades | Port not published; synthetic data only | NFR5.5; accepted risk above |
| Malformed or hostile input crashes the server | Inputs are small strings | NFR5.3 |
| The data set is read in bulk | No tool returns it | NFR5.1 |
| A change is lost or doubled by overlapping writes | Single process, writes taken one at a time | BR2.6 |
