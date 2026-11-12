# Cross-Unit Traceability — Guardrails Sample

Source: `aidlc engine sensor-traceability --stage build-and-test` (run in this stage). Verdict from the tool: **fail**, with one uncovered ID: `NFR1`. Everything else is covered.

## Verdict

| Check | Result |
|---|---|
| Functional requirements FR1.1 to FR11.2 (25 IDs) | all covered |
| Acceptance criteria AC1.1.1 to AC6.4.3 (62 IDs) | all covered |
| NFR2, NFR3, NFR4, NFR5, NFR6, NFR7 | covered |
| NFR1 (performance) | **uncovered** per the tool |

## The One Uncovered ID: NFR1

The tool lists NFR1 as uncovered because one row is not built: `u3-plugin-ui: NFR1.1` is marked `Deferred` in u3's `traceability.json` with the reason "Built and run by u5 against the compose sample in Chrome and Firefox (plan decision: real-browser checks are u5's)". Resolution:

| Item | Status |
|---|---|
| `u3-plugin-ui: NFR1.1` (each view shows its data within its limit) | Deferred by plan to u5, which built it |
| `u5-compose-and-ci: NFR1.1` (p95 of 20 loads of each view ≤ 5 s, blocking) | built (`packages/e2e/specs/timing.spec.ts`); passed in the pipeline job `compose-e2e` on `main` at `9cbd241` |
| Every other NFR1 row of u1, u2, u3, u4, u5 and u6 | built; the u6 row (NFR1.5) is report-only by the person's choice |

So the requirement is met by u5's check. The tool cannot see a deferral as coverage, so this stays a build-and-test finding that is surfaced at the approval gate. It does not need new code. To clear the flag, u3's row would be remapped to u5's timing spec in a later change to u3's `traceability.json`; that file is a reviewed output and was not edited here.

## Coverage by Owner

| Requirement group | Built by | Target files (examples) |
|---|---|---|
| FR1 to FR2 (plan, failed runs, propose) | u1, u2, u3 | `guardrailsData.ts`, `router.ts`, `GuardrailsView.test.tsx` |
| FR3 (approval-gated writes) | u2, u3 | `changeWorkflow.ts`, `ChangeDetailScreen.test.tsx` |
| FR4 (audit log) | u2, u3 | `auditStore.ts` |
| FR5, FR11.2 (identity, errors) | u2, u3, u4 | `demoUsers.ts`, `serverHealth.ts`, `SignInPage.tsx` |
| FR6, FR7 (server, seeded data) | u1 | `app.ts`, `generator.ts` |
| FR8.1 (compose) | u5 | `packages/e2e/src/commands.ts`, `compose.yaml` |
| FR9.1 (minikube) | u6 | `packages/e2e/src/minikubeCommands.ts`, `k8s/` |
| FR10.1 (CI) | u5, u6 | `.github/workflows/ci.yml` |
| NFR1 to NFR7 | every unit | see the Target Verification Matrix |

## Not Applicable

| ID | Reason |
|---|---|
| `u6-minikube-run: NFR5.12` | u5's built-image missing-address check covers the same image; u6 adds no second check |

## Findings Surfaced at the Gate

1. NFR1 is flagged by the tool (explained above; no code gap).
2. No target is `Unverified` in the summary. The screen-reader pass for u3, u4 and u5 and the merge-blocking repository setting for u5 are `Met` (evidence SR and BP). The u6 live checks are `Met` on the pipeline run of PR #6.
