# Personas

Sources: `requirements.md` (FR5, FR3.3), intent statement (equal primary users), and answers Q1–Q4 in `user-stories-questions.md`. Names are synthetic demo users.

## Sam, the Service Owner (primary)

- **Role:** Owns one or more services in the catalog.
- **Goals:** See what to upgrade and why CI is failing for a service, and get fixes proposed without leaving Backstage.
- **Pain points:** Guardrail insight lives outside Backstage, so Sam does not look there.
- **Context:** Works on the service's catalog page; signs in as a demo user.

## Priya, the Platform Engineer (primary)

- **Role:** Operates the guardrails and approves writes made by others.
- **Goals:** Review what a change will do, approve or reject it with a reason, and know the audit log shows exactly who decided what.
- **Pain points:** Writes without a visible approval or audit trail.
- **Context:** Works from the same catalog page; signs in as a different demo user from the proposer.

## Alex, the Auditor (secondary, read-only)

- **Role:** Reviews what was changed and by whom.
- **Goals:** Read and filter the audit log without being able to propose or decide anything.
- **Pain points:** Entries that cannot be trusted or filtered.
- **Context:** Opens the audit log only.

## Relationships and Priority

- Sam and Priya are equally primary; they are deliberately different people for any one change, because the proposer cannot approve their own change (FR3.3).
- Alex is secondary: the auditor role adds a read-only view over the same audit log and no new capability.
