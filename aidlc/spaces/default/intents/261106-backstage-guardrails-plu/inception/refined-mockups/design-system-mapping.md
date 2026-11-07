# Design System Mapping

The sample uses Backstage's standard components with a custom theme (Q3: A). Names below are the real Backstage core components (`@backstage/core-components`) and Material UI parts; "custom" marks what the plugin builds itself. Exact imports are confirmed at construction.

## Component Map

| Mockup element | Component | Standard or custom |
|---|---|---|
| Overview card (Screen A) | `InfoCard` | Standard |
| Page header and breadcrumbs | `Page`, `Header`, `Breadcrumbs` | Standard |
| Upgrade plan, CI triage, open changes, audit log | `Table` | Standard. Column sorting is explicitly turned off (no screen or requirement needs it) |
| Status label | `StatusOK` (Applied), `StatusError` (Rejected, Failed), `StatusPending` (Pending), `StatusWarning` (Refused), plus a text label | Standard icons; the combined icon-plus-text label is custom |
| Propose, Approve, Reject, Retry, Back | Backstage `Button` | Standard. Disabled actions use `aria-disabled` with a linked reason, so a thin custom wrapper is needed |
| Reason input | Material UI `TextField` (multiline) with helper text | Standard; the threshold announcement of the counter is custom |
| Result banner | Material UI `Alert` (`@material-ui/lab`), role `status`, focused on mount | Standard component, custom focus behavior |
| Empty states | Plain `Typography` message | Standard. Backstage `EmptyState` is not used because it expects an illustration |
| Server error panel | `ErrorPanel` plus a Retry `Button` | Standard |
| Loading | `Progress` or skeleton rows with `aria-busy` | Standard |
| Audit filters | Material UI `Select` (actor, action, outcome) and two `TextField type="date"` for the time range | Standard |
| Demo-user switch | Material UI `Menu` opened from a `Button`, inside the header | Custom |
| Demo sign-in and identity | A sign-in provider with three demo users (Sam, Priya, Alex), each a real sign-in identity with a fixed role (service owner, platform engineer, auditor). The header switch changes the identity the plugin backend receives; the backend reads the acting user and role from that identity, never from the request body (Q11: A) | Custom for the sample |
| Paging | Material UI `TablePagination`-style Previous/Next controls, 10 rows per page, on the plan, CI and audit tables | Standard, with Previous, Next and "Page N of M" labels from the string catalog |
| Proposed status label | An info icon plus the word "Proposed" | Custom (Backstage has no matching status component) |
| Brand mark | Shield SVG in the header and card title | Custom |

## Theme Values (placeholder)

The theme is created with Backstage's unified theme, overriding palette values.

| Theme key | Value | Purpose |
|---|---|---|
| `palette.primary.main` | `#1F3A93` | Primary buttons, links, header accent; contrast on white about 10:1 |
| `palette.primary.contrastText` | `#FFFFFF` | Text on the accent |
| Status colors | Backstage defaults | Always used with icons and text |

The brand mark is a separate asset (`shield.svg`), not a theme key.

## Replacement Point

The primary color and the shield file are set in one theme file in the plugin, so supplying the real palette and logo later changes no screen (Q3: A).

## Compliance

- Standard components provide keyboard behavior and focus handling.
- Custom parts are limited to the combined status label, the disabled-action wrapper, the banner focus behavior, the counter announcements, the demo-user switch and the sample sign-in.
