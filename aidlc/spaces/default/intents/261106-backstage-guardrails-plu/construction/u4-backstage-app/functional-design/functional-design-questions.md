# Functional Design — u4-backstage-app — Questions

u4 is the host Backstage app: wiring and configuration only, no business rules, no entities of its own. It loads the two guardrails plugins and the demo sign-in, declares the catalog of the seeded services, and takes the guardrails server address and the database from settings. It carries stories US5.1 (the app's part: the demo users can sign in) and US6.2 (the app comes up with the plugin and the data), and it is where the project's root README is started (your request).

Already fixed by earlier stages, so not asked again: the new Backstage frontend system and new backend system; the plugin ids and settings keys of contract C3 (`guardrails.server.url`, the two timeouts, `guardrails.demoSignIn.enabled`); the demo sign-in is off in the shipped settings and on only in the compose override; no address in code; the app's health route (`/.backstage/health/v1/readiness`, contract C4); u3's plugin keeps its own token and falls back to the app's own sign-in, so the app's sign-in must be one of the three demo users for the backend to accept it.

Settled as design choices without asking (written into the design for you to correct):
- A minimal app: the catalog (service overview and the Guardrails tab and card), the sign-in, and the guardrails plugins. No scaffolder, TechDocs, search, Kubernetes or other plugins.
- The catalog also declares one User entity for each of Sam, Priya and Alex, so names show in the app; their ids are the demo `userId` values.
- The shipped settings read the guardrails server address from the environment variable `GUARDRAILS_SERVER_URL` and the demo sign-in switch from `GUARDRAILS_DEMO_SIGN_IN`; the shipped default for the second is `false`. Local development without compose uses an in-memory SQLite database; the compose override (u5) supplies PostgreSQL.
- The root `README.md` is started in this unit and covers the whole project: what it is, how the five units fit together, the contracts, the demo users and the sign-in risk, how to run and test it, CI, and known limits. u5 extends it with the compose run and the browser checks.

## Q1. [Catalog] Where do the catalog entries for the seeded services come from?

Why we ask: the plugin calls the backend with the catalog entity name, so every name must equal a service the guardrails server knows (contract C2 and C3 open question). The generator makes six services from the default seed (`catalog-portal`, `checkout-bridge`, `inventory-bridge`, `notify-console`, `profile-sync`, `profile-worker`), and a different seed makes different data. Recommendation: A, because the catalog then always matches the data and a test can prove it.

- A. A script writes the catalog file from the generator's output for the seed in use, and the committed copy is checked by a test against the generator's default seed, so they cannot drift
- B. The names are written by hand in the catalog file, with a test that fails when they differ from the default seed's names
- C. The app reads the generator at start-up and builds the entries in memory
- X. Other (please specify)

[Answer]: A

## Q2. [Sign-in] What does a person see when they first open the app?

Why we ask: the backend refuses anyone who is not one of the three demo users, so the app's own sign-in must make the person one of them. Recommendation: A, because it shows the three users clearly and matches what the audit log will name.

- A. A sign-in page that lists Sam, Priya and Alex with their roles; choosing one signs in as that user (the Guardrails header still lets them switch later)
- B. No page: the app signs in as Sam on its own at once, and the Guardrails header is the only way to switch
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- The catalog entries for the seeded services are written by a script from the generator's output for the seed in use, and a test checks the committed copy against the generator's default seed (Q1: A)
- The first thing a person sees is a sign-in page listing Sam, Priya and Alex with their roles; choosing one signs in as that user, and the Guardrails header can still switch later (Q2: A)
- Design choices set without asking: a minimal app (catalog, sign-in, the two guardrails plugins); User entities for the three demo users; settings read GUARDRAILS_SERVER_URL and GUARDRAILS_DEMO_SIGN_IN (default false) from the environment, with an in-memory SQLite database for plain local development and PostgreSQL supplied by the compose override; the root README.md is started in this unit and covers the whole project

- Looks correct
- Request changes

[Answer]: Looks correct
