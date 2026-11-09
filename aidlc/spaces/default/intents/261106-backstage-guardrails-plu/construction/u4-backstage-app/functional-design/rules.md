# Rules — u4-backstage-app

The rules of this unit. u4 holds wiring and configuration only and decides no business rule (the backend does, in u2); these are rules about what the app loads, what a person sees when signing in, what the catalog contains and what the settings must be. `functional-spec.md` holds the workflows and states that use them. Category is one of validation, authorization (shown only, never decided), constraint, calculation, policy.

```yaml
rules:
  - id: BR1.1
    statement: The app loads exactly the guardrails parts and the Backstage parts it needs, and nothing else.
    category: constraint
    applies_to: backend entry point, frontend entry point
    trigger: the app starts
    logic: IF the backend starts THEN it always loads the catalog, the auth backend, plugin-guardrails-backend and its demo sign-in module authModuleDemoSignIn (the module itself registers the provider only when the switch is on, BR2.1); IF the frontend starts THEN it loads the catalog pages, the sign-in page of BR2.2 and guardrailsPlugin. The app is two packages, `packages/app` (frontend) and `packages/backend` (backend).
    violation: a missing part is a start-up failure with a message naming it; an extra plugin is a defect (the sample stays minimal).
    source: FR8.1
  - id: BR1.2
    statement: The app contains no business rule.
    category: constraint
    applies_to: the whole unit
    trigger: always
    logic: Who may do what, which state allows which action and what is audited are decided by plugin-guardrails-backend; the app only registers, configures and shows.
    violation: any rule code in the app is a defect.
    source: unit-of-work.md (U4 boundaries)
  - id: BR2.1
    statement: The demo sign-in provider exists only while the demo sign-in setting is on.
    category: authorization
    applies_to: backend configuration
    trigger: the backend starts
    logic: IF guardrails.demoSignIn.enabled is true THEN the demo provider and the open user list are available and a start-up warning is logged by u2; ELSE neither exists. The shipped value is false.
    violation: a hosted copy with the setting on is a defect (accepted risk of u2 NFR5.3).
    source: FR5.1
  - id: BR2.2
    statement: The first thing a person sees is a sign-in page that lists the demo users with their roles.
    category: policy
    applies_to: sign-in page
    trigger: the app opens with no signed-in user
    logic: IF the user list is available THEN show Sam, Priya and Alex with their role labels (from the list, not from the catalog) as three choices and nothing else that signs in; choosing one signs in as that user (BR2.3). IF the list answers 401 or 404 THEN show the text that the demo sign-in is off and offer no way to sign in (the page is signed out, and u2 opens the route to signed-out callers only while the switch is on; with the switch off a signed-out caller gets 401 and a signed-in one 404). IF the list cannot be read for any other reason (no answer within 5 seconds, a server error) THEN show a text that the users could not be loaded and a Retry action. The start call gives up after 5 seconds and shows the sign-in failed text.
    violation: none (a display rule)
    source: FR5.1, AC5.1.1
  - id: BR2.3
    statement: Choosing a user signs the browser in as that demo user with no password.
    category: constraint
    applies_to: sign-in page
    trigger: a user is chosen
    logic: Ask the sign-in start address for the chosen userId, take the identity and token it answers, and hand them to the app as the signed-in user; IF the start address answers an error THEN stay on the page and show the text for it. The user ids come from the list, never from typing.
    violation: on failure nobody is signed in.
    source: FR5.1, AC5.1.1
  - id: BR2.4
    statement: Whoever is signed in to the app is one of the three demo users, so the plugin's calls without a chosen user are accepted by the backend.
    category: constraint
    applies_to: sign-in
    trigger: a person is signed in
    logic: The app signs in only through BR2.3; there is no guest sign-in. The Guardrails header's switch (u3) remains available and replaces the credential for the plugin's calls only.
    violation: a signed-in person who is not a demo user would be refused by the backend with 401 (AC5.1.3).
    source: FR5.2, AC5.1.2, AC5.1.3
  - id: BR2.5
    statement: Signing out returns to the sign-in page, and nothing of the previous user stays visible.
    category: policy
    applies_to: sign-in
    trigger: the person signs out
    logic: IF the person signs out THEN end the app session (forget the identity and token held in memory) and show the sign-in page. The demo provider's own logout route does nothing, so the app does not call it.
    violation: none
    source: FR5.1
  - id: BR2.6
    statement: The app's sign-in lasts for the life of the page and is not renewed.
    category: constraint
    applies_to: sign-in, session
    trigger: the person signs in, reloads the page, or the token expires
    logic: The answer of the start address is {profile, providerInfo, backstageIdentity:{token, identity}}; the app keeps the identity and token in memory only (nothing in storage). The demo provider has no refresh route. IF the page is reloaded THEN nobody is signed in and the sign-in page shows again. IF the token expires THEN the plugin's calls answer 401 and the person sees u3's session-ended text and signs in again; the app does not renew it silently.
    violation: a token written to storage or renewed in the background is a defect.
    source: FR5.1, AC5.1.1
  - id: BR3.1
    statement: The catalog holds exactly one service entry for each seeded service, named as the seed names it.
    category: constraint
    applies_to: catalog file
    trigger: the app starts, and every test run
    logic: IF the generator's output for the seed in use has services THEN the catalog file has one Component for each, named by its serviceName; no other Component exists.
    violation: a service the server knows but the catalog lacks cannot be opened; an entry the server does not know shows the unreachable or not found texts of u3 (a defect).
    source: FR8.1, FR7.2, AC6.2.2
  - id: BR3.5
    statement: The committed catalog matches the default seed only; any other seed needs the catalog written again for it.
    category: constraint
    applies_to: catalog script, compose run
    trigger: a run uses a seed other than 20261106
    logic: The service names depend on the seed. The script takes a seed (`--seed`) and an output path (`--out`); a run that sets GUARDRAILS_SEED to another value must write the catalog with the same seed and point the app's catalog location at that file. The committed file and the test cover the default seed only. u4's scripts and test therefore depend on the u1 generator (a development and test dependency only; the running app does not need u1's code).
    violation: a seed and a catalog that disagree make some service pages show not found; the README states this coupling.
    source: FR7.2, C4 (GUARDRAILS_SEED)
  - id: BR3.2
    statement: The catalog file is written by a script from the generator and the committed copy is checked against the default seed.
    category: constraint
    applies_to: catalog script, catalog test
    trigger: the script runs, and every test run
    logic: The script prints the catalog file for a given seed (default 20261106); the test fails when the committed file differs from the script's output for the default seed.
    violation: a test failure.
    source: FR7.2, FR8.1
  - id: BR3.3
    statement: The catalog also holds one User for each demo user and one Group that owns the services.
    category: policy
    applies_to: catalog file
    trigger: the app starts
    logic: Users sam, priya and alex with their display names, members of the group guardrails-demo, which is the owner of every service entry.
    violation: none
    source: FR5.1
  - id: BR3.4
    statement: The catalog is read from the committed files and cannot be changed from the app.
    category: constraint
    applies_to: catalog configuration
    trigger: the app starts
    logic: The catalog locations are local files under the app's own folder; catalog editing from the user interface is off.
    violation: none
    source: FR8.1
  - id: BR4.1
    statement: The guardrails server address comes from the environment and has no default.
    category: constraint
    applies_to: settings
    trigger: the app starts
    logic: guardrails.server.url is filled by GUARDRAILS_SERVER_URL. IF the variable is missing THEN the guardrails plugin stops the app at start-up with its own message, which names the setting `guardrails.server.url`; the README and the settings table say that GUARDRAILS_SERVER_URL fills it. The two timeouts keep the contract defaults (3000 and 10000 ms) unless overridden.
    violation: start-up failure; an address written in code or in a committed file is a defect.
    source: FR8.1, hosting later
  - id: BR4.2
    statement: The demo sign-in switch comes from the environment and is off unless set.
    category: constraint
    applies_to: settings
    trigger: the app starts
    logic: guardrails.demoSignIn.enabled is filled by GUARDRAILS_DEMO_SIGN_IN, default false. The compose override (u5) sets it to true.
    violation: a shipped default of true is a defect.
    source: FR5.1
  - id: BR4.3
    statement: The database is in memory for plain local development, and any other database is supplied by the environment.
    category: constraint
    applies_to: settings
    trigger: the app starts
    logic: IF no database setting is supplied THEN use an in-memory SQLite database (changes and audit entries are lost on restart); the compose override supplies PostgreSQL with its login from environment variables.
    violation: a database password written in a committed file is a defect.
    source: FR8.1, NFR5
  - id: BR4.5
    statement: The app's own base addresses are Backstage's local-development values and can be replaced from the environment.
    category: constraint
    applies_to: settings
    trigger: the app starts
    logic: The shipped settings hold the app's own addresses for plain local development (app.baseUrl, backend.baseUrl and the backend listen port, as in any Backstage app); each is overridable by an environment variable so compose can replace them. They are not the guardrails server's address, which has no default (BR4.1). No address appears in code.
    violation: an address in source code is a defect.
    source: FR8.1, hosting later
  - id: BR4.4
    statement: No secret is written in a committed file.
    category: constraint
    applies_to: all committed settings and scripts
    trigger: always
    logic: Values that are secret (a database password) come from environment variables; the sample values in documentation are labelled as samples.
    violation: a secret in a file is a defect.
    source: phase security rules
  - id: BR5.1
    statement: The app answers the readiness route so the compose run can tell when it is up.
    category: constraint
    applies_to: backend
    trigger: the backend is ready
    logic: GET /.backstage/health/v1/readiness answers 200 once the backend and its plugins have started.
    violation: none (Backstage provides it; the test only confirms it is not turned off)
    source: C4, AC6.2.1
  - id: BR5.2
    statement: The root README.md documents the whole project and is kept in step with the code.
    category: policy
    applies_to: README.md
    trigger: this unit is built, and when a later unit changes how the project is run
    logic: The README covers what the project is, the units and contracts, the demo users and the sign-in risk, the settings of BR4.1 to BR4.4, how to run and test it, the CI jobs and the known limits; u5 adds the compose run and the browser checks.
    violation: a README that no longer matches the commands is a defect.
    source: the person's request in the u4 session
  - id: BR5.3
    statement: The app's own code is tested test-first and held to the 85% line floor.
    category: constraint
    applies_to: packages/app, packages/backend, catalog script
    trigger: tests run in CI and locally
    logic: The sign-in page, the identity handling, the catalog script and test, and the settings check have tests written before the code; line coverage over this code (not over generated or purely declarative configuration files) is at least 85%, the project floor, and is never lowered.
    violation: coverage below 85% fails CI.
    source: team practices (project.md Mandated)
```

## Rules Summary

| Group | Rules | Subject |
|---|---|---|
| 1 Wiring | BR1.1 to BR1.2 | What is loaded, no business rule |
| 2 Sign-in | BR2.1 to BR2.6 | Demo provider, sign-in page, no password, only demo users, sign-out, session life |
| 3 Catalog | BR3.1 to BR3.5 | Services, generator link and test, users and group, read only, seed coupling |
| 4 Settings | BR4.1 to BR4.5 | Server address, demo switch, database, no secrets, own addresses |
| 5 Health, docs and tests | BR5.1 to BR5.3 | Readiness route, README, coverage |
