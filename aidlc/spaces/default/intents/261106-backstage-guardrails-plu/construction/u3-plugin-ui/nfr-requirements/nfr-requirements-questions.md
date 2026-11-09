# NFR Requirements Questions — u3-plugin-ui

Context: the targets for this unit already come from NFR1 (each view shows its data within 5 seconds), NFR3 (WCAG 2.1 AA), NFR4 (current Chrome and Firefox on desktop), NFR2 (85% line coverage, tests first) and NFR6 (Prettier and ESLint). Two choices are left open and change the tooling, so they are asked here. Everything else (what is stored in the browser, how the token is kept, test libraries for the unit tests) is settled in the documents and listed in `tech-stack-decisions.md`.

## Q1. [Developer] Which Backstage frontend system should the plugin be built for?

Backstage has two ways to build a frontend plugin. The host app (u4) must use the same one as the plugin, so this choice also decides how u4 loads it. The service page tab and the overview card are placed the same way on the screen in both.

A. The new frontend system. The plugin declares its tab and card as extensions that the app discovers; this is the direction Backstage is moving in and what new Backstage apps start with.
B. The legacy frontend system. The app imports the plugin's tab and card by hand into its entity page. More examples exist online, but it is the older way.
X. Other (please specify)

[Answer]: A

## Q2. [Quality] How are the accessibility scan and the Chrome and Firefox checks run?

The requirements ask for an automated accessibility scan on every screen state (NFR3) and for the flows to work in current Chrome and Firefox (NFR4). A scan in a simulated browser catches most structure problems but not contrast or real focus behavior.

A. Two layers. Unit tests in a simulated browser scan every screen state with an accessibility checker (runs in every pull request, counts toward the 85% coverage). The real-browser scan, the Chrome and Firefox walkthroughs and the 20-load timing run against the compose sample and are built by u5 (the compose and CI unit).
B. Simulated browser only. The unit tests scan every state; the real-browser checks are done by hand once and written down.
C. Real browsers in this unit. This unit also sets up a browser test tool and runs the scan and walkthroughs in Chrome and Firefox itself, in addition to the unit tests.
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Summary of the answers:

- Q1: the plugin is built for the new Backstage frontend system; the host app (u4) loads it the same way.
- Q2: unit tests scan every screen state in a simulated browser on every pull request; the real-browser scan, the Chrome and Firefox walkthroughs and the 20-load timing run against the compose sample and are built by u5.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
