## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-08T18:18:56Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/nfr-design/security-design.md > Write Check Order, steps 3 to 6 | For a propose, the table puts "the service, run or change exists" (step 3) before the auditor refusal (step 5) and the health probe (step 6). Propose existence can only be checked by reading the guardrails server (W2 step 2, BR2.5), so step 3 already needs the server, which contradicts the probe coming later. Functional-spec W2 refuses the auditor first and appends a refused entry (BR2.4); under this table an auditor who proposes a missing target gets 404, and one who proposes while the server is down gets 503 with no refused entry. Step 3 also does not say whether an unreachable server on a propose is SERVER_UNREACHABLE from the read or from the probe. | Give propose its own order (input shape, auditor refusal with its entry, server read or probe, existence and eligibility), or state in the table that for propose the auditor check precedes existence. Say where BR2.5 sits. Keep the deliberate decision-side order. | New |
| R-02 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/nfr-design/traceability.json > upstream_ids and security-design.md > Design Summary | Traceability covers only NFR5.1 to NFR5.10 and NFR1.7. The quality targets in tech-stack-decisions.md NFR1.1 to NFR1.6 and NFR1.8 have no design: nothing on query shape or pagination for the 300 ms p95, no pool use for 10 concurrent requests, nothing for 100,000 audit entries beyond "indexed". NFR2.4 (start-up migrations), NFR2.11 (readiness) and NFR2.5 timeouts are only cited in passing. The preamble of security-design.md claims concurrency, recovery and logging designs sit "in the rows below", but the rows cover only security. | Add the missing NFR IDs to upstream_ids with a concrete target each (or an explicit not-applicable note). Add a short performance and concurrency design: indexes and paging for the audit read, pool use, the 5 second probe reuse, and where NFR1.5 and NFR1.6 are verified. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/nfr-design/logical-components.md > Failure Domains, "Health probe cache wrong for up to 5 seconds" | The row says a write "is re-checked by the probe at the time (BR7.7)", but BR7.1 reuses the probe result for 5 seconds. It is unclear whether writes bypass the cache. If they do not, a stale "reachable" lets a write claim during an outage and end failed; a stale "unreachable" refuses a valid write. | State whether writes use a fresh probe or the cached one, and the resulting behaviour. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/nfr-design/logical-components.md > Failure Domains, "Database down" | The row says every route except the open user list fails with 500. The signed-in-user read (BR6.5) needs only the identity, not the database, so it should keep working. Backstage's HTTP router also blocks unauthenticated access by default; the design does not say the user-list route opts out of that. | Correct the "keeps working" column for the me read. Add a line that the user-list route is explicitly marked unauthenticated and only while the demo sign-in is on. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/nfr-design/security-design.md > NFR5.5 | The trigger blocks row UPDATE and DELETE only. TRUNCATE is not covered and the design does not say so. | Add a statement-level guard against TRUNCATE (or record it as accepted with the owner-login risk) and include it in the append-only test. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/nfr-design/security-design.md > NFR5.8 and NFR5.9 | BR7.4 logs the audit repair failure and the error handler logs the error class. Database driver error text can carry bound values (for example constraint detail), and the design does not say that only a fixed message and class are logged for these two paths. | State that these log lines carry only the event name, change id and error class, never driver message text. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| none run (per brief) | n/a | Cross-references checked by reading: BR3.x, BR5.x, BR7.3, BR7.4, BR7.7, NFR5.x, NFR1.7, C1 and C3 all resolve. The design contains no implementation code. |

### Summary

The security design is sound on identity, the open user-list exemption (Q1: A), the off-by-default demo switch, the append-only audit store and no-values logging, and the failure domains agree with BR5.5, BR7.3, BR7.4 and BR7.7. The two Major findings are the propose-side check order, which contradicts W2 and BR2.4, and the missing design for the performance and concurrency targets in the NFR1.x set. Both are fixable in place; with two Major and no Critical the verdict is READY, but the person should weigh them at the gate.
