# Functional Design Questions — u3-plugin-ui

Context: the screens, texts and accessibility behavior of this unit are already fixed in the refined mockups, and the backend interface (C1) is fixed by u2. One point is left open by those documents and changes how the sample is wired together, so it is asked here. Smaller details (where the view sits on the service page, texts for the new disabled reasons, how lists refresh) are settled in the design and listed in `functional-spec.md` under "Design decisions taken".

## Q1. [Developer] How does the demo-user switch change who you are?

The mockups say that switching users keeps the same screen, clears the banner, re-checks every action and announces "Signed in as Sam." The backend sign-in (u2) answers `GET /api/auth/demo/start?userId=<id>` with a Backstage token for that user. Backstage itself normally decides who is signed in only when the whole app signs in, so the switch has two possible shapes. This decides what u4 (the host app) has to wire and whether the switch can keep the page and announce the change.

A. The Guardrails plugin holds the chosen user's token and sends it on its own calls to the plugin backend. Switching is instant, keeps the page, focus and announcement exactly as the mockups say, and needs no change to the host app's sign-in. The rest of Backstage (for example the profile menu) still shows the user who first signed in.
B. The switch signs the whole Backstage app out and back in as the chosen user, then reloads. The whole app agrees on who is signed in, but the page reloads, so the "stay on the same screen" and "Signed in as Sam" announcement need extra handling after the reload, and u4 must wire a sign-in page that offers the demo provider.
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Summary of the answers:

- Q1: the Guardrails plugin holds the chosen demo user's token and sends it on its own calls; the rest of the app keeps the user who first signed in.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
