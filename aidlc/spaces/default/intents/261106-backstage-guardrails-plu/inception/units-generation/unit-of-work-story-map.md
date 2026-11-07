# Unit-of-Work Story Map

Sources: `stories.md` (US IDs), `unit-of-work.md` (unit IDs and directories) and `unit-of-work-dependency.md`. Each row names every unit that implements part of the story; separate units are joined with `;`.

| Story | Unit ID | Directory |
|---|---|---|
| US1.1 | U1; U2; U3 | u1-data-and-server; u2-plugin-backend; u3-plugin-ui |
| US1.2 | U1; U2; U3 | u1-data-and-server; u2-plugin-backend; u3-plugin-ui |
| US2.1 | U2; U3 | u2-plugin-backend; u3-plugin-ui |
| US2.2 | U2; U3 | u2-plugin-backend; u3-plugin-ui |
| US3.1 | U2; U3 | u2-plugin-backend; u3-plugin-ui |
| US3.2 | U2; U3 | u2-plugin-backend; u3-plugin-ui |
| US3.3 | U1; U2; U3 | u1-data-and-server; u2-plugin-backend; u3-plugin-ui |
| US4.1 | U2; U3 | u2-plugin-backend; u3-plugin-ui |
| US5.1 | U2; U3; U4 | u2-plugin-backend; u3-plugin-ui; u4-backstage-app |
| US5.2 | U2; U3 | u2-plugin-backend; u3-plugin-ui |
| US6.1 | U1 | u1-data-and-server |
| US6.2 | U4; U5 | u4-backstage-app; u5-compose-and-ci |
| US6.3 | U6 | u6-minikube-run |
| US6.4 | U5 | u5-compose-and-ci |

## Cross-Cutting Rows

Rows with more than one unit are cross-cutting: US1.1, US1.2, US3.3 (all three of U1, U2, U3), and US5.1 (U2, U3, U4). The unit that owns the main part of each is the first listed in the traceability record.

## Implementation Order Within Each Unit

Within a unit, work follows the team's test-first practice (write a failing test before the code) and the story order below. The order across units is chosen in Delivery Planning.

| Unit | Stories, in the order to work them |
|---|---|
| U1 | US6.1, US1.1, US1.2, US3.3 |
| U2 | US5.1, US2.1, US2.2, US3.1, US3.2, US3.3, US4.1, US1.1, US1.2, US5.2 |
| U3 | US1.1, US1.2, US2.1, US2.2, US3.1, US3.2, US3.3, US4.1, US5.1, US5.2 |
| U4 | US5.1, US6.2 |
| U5 | US6.2, US6.4 |
| U6 | US6.3 |

## Coverage Verification

- Every one of the 14 stories (US1.1 to US6.4) is assigned to at least one unit.
- Every unit has at least one story: U1 (4), U2 (10), U3 (10), U4 (2), U5 (2), U6 (1).
