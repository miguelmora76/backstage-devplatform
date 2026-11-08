## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-08T18:28:04Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/infrastructure-design/cicd-pipeline.md > Secrets in the Pipeline and the Sample (demo sign-in) and NFR to Infrastructure Mapping (NFR2.6, NFR5.3) | The design makes u4 keep the demo sign-in "off in the shipped app-config" and u5 switch it "on in the compose override", but contract C3 defines no such setting. C3 lists only guardrails.server.url, readTimeoutMs and writeTimeoutMs, and its sign_in block has no enabled flag. u4 and u5 cannot implement a key nobody has named, and u4 owns the C3 settings. | Name the setting key and its default (off) in this document. Record it as an additive change to C3 owned by u4's settings, with u2 reading it. List it under Dependencies on Other Units so u4 and u5 pick it up. | New |
| R-02 | Major | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/infrastructure-design/cicd-pipeline.md > Dependencies on Other Units and NFR2.7 row | The database login is said to be "settings supplied by compose", and the plugin reads Backstage's database settings. Those settings are the host app's backend.database block, which u4 owns. The dependency list gives u4 only the sign-in default and the C3 keys. It never asks u4 to configure the PostgreSQL client and to read host, port, user and password from environment variables, and C3 has no such entry. Without that, the app can fall back to its default non-PostgreSQL store and the rule tests no longer match runtime. | Add a dependency on u4: backend.database uses the PostgreSQL client, with the connection fields taken from environment variables. Add a dependency on u5: compose supplies the same variable names to the app and to the PostgreSQL service. Name the variables or say where they are fixed. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/infrastructure-design/cicd-pipeline.md > NFR to Infrastructure Mapping (NFR5.8) vs Secrets in the Pipeline and the Sample | The NFR5.8 row says "No secret in code, image or workflow". The Secrets section says the CI PostgreSQL service container uses a throw-away password written in the workflow file. | Reword NFR5.8 to allow the explicit throw-away CI password, or read it from a non-secret workflow variable. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/infrastructure-design/cicd-pipeline.md > Deployment Shape Used by the Pipeline and Build and Test Stages | There are three PostgreSQL instances (the u5 compose service, the local test compose service, the CI service container). No PostgreSQL major version is stated or required to match across them, so the rule tests could pass on a different version than the sample runs. | State one pinned PostgreSQL major version, shared with u5, for all three. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/infrastructure-design/cicd-pipeline.md > NFR to Infrastructure Mapping (NFR5.10) and Build and Test Stages (stage 5) | NFR5.10 is mapped to "named volume in compose" plus the stage 5 restart test. The CI service container has no named volume and no compose, so CI cannot show that data survives a restart of the sample. It can only show that state sits in PostgreSQL across a plugin restart. | Say which of the two the stage 5 restart test proves. Leave the volume check to u5's compose verification, or add a documented manual check. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/infrastructure-design/cicd-pipeline.md > Build and Test Stages (stage 6) and Branching | Stage 6 merges coverage from stages 4 and 5, but the document does not say whether they are separate jobs with the report shared as an artifact or one job. It also does not say who configures "required checks = stages 1 to 8" in branch protection on a workflow this unit does not own. | State the job layout used to merge coverage and name the owner of the required-check list (the unit that creates the workflow). | New |
| R-07 | Minor | aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u2-plugin-backend/infrastructure-design/infrastructure-design-questions.md > intro and Q2 | The intro says this unit "owns no compose file". Q2 and the pipeline document give this unit a throw-away test compose file kept with its tests. | Correct the intro to "owns no runtime compose file". | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| none run (not requested) | n/a | Checked by reading: all 25 upstream_ids in traceability.json have a row. Every OK target and every N/A reason is concrete. Each OK target appears in cicd-pipeline.md's mapping table. Stage ordering, the 85% floor, real PostgreSQL, the CI service container and the absence of Docker-in-Docker are coherent. Nothing deploys, which matches team practices. No complete IaC is present. |

### Summary

The pipeline is coherent and traceable, and it respects the team practices (PR before merge, no automatic deploy, local compose). Two cross-unit gaps remain: the demo sign-in toggle and the PostgreSQL connection settings are placed on u4 and u5 without being defined in contract C3 or the dependency list. They are fixable in prose and do not block, so the verdict is READY with two Majors.
