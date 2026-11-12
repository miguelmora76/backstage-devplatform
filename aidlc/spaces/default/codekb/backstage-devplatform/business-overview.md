# Business Overview

## Purpose
A sample Backstage developer platform that adds "guardrails" to service management. A signed-in person opens a service in the catalog, goes to its Guardrails tab, and proposes governed changes (dependency upgrade plans, CI-failure re-runs). Changes are checked against rules, applied or refused, and recorded in an append-only audit log. It is a local-only sample (docker compose, optional minikube); nothing deploys automatically (README, team rules).

## Key functionality
- Read-only software catalog of services, users and groups from a committed file (`packages/backend/catalog/guardrails-catalog.yaml`).
- Demo sign-in: three invented users (service owner, platform engineer, auditor), no password; the only way in.
- Guardrails entity tab: upgrade plan, CI triage, open changes, audit log; change detail screen with approve/reject; demo-user switch.
- Guardrails overview card on the entity page.

## Users
Service owner (Sam), platform engineer (Priya), auditor (Alex). Roles drive which actions are allowed (`plugin-guardrails-backend/src/rules/allowedActions.ts`).

## Current intent context
Intent 261112-ui-redesign-polish: fix and polish the look of the host app (sign-in, catalog, service overview, tabs) into one consistent dark theme shared with the Guardrails plugin, working in Chrome and Safari, with the same screens and behaviour. The root README itself notes "The app has little styling of its own" (README.md:256). See code-quality-assessment.md for the cause.
