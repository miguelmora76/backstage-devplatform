# NFR Design — u3-plugin-ui — Questions

This stage turns the NFR Requirements of this unit into patterns. Already fixed by earlier stages, so not asked again: the new frontend system, Material UI 4 and React Testing Library with `msw`, no data-fetching library, the 5 second read and 12 second write limits, the token in memory with only the userId in tab storage, the discovery service for addresses, and the browser checks that u5 builds.

Settled as design choices without asking (written into the design for you to correct, and they also answer minor points the review of the requirements raised):
- Every section starts its own load when it mounts, so the page takes as long as its slowest section; a stale answer from an older load is dropped.
- A timeout in the page is treated like a lost connection, so screens handle one failure case.
- Pressing an action shows "Working..." in the same render and ignores a second press, even inside one frame.
- After a 401 the plugin asks the start path for a new token once and repeats a read once; a write is never repeated on its own; a second 401 shows the "demo session ended" text.
- Plan and CI lists are paged in the browser; only the audit asks the backend for a page.
- Screens load when their route opens (route-level lazy loading), not at app start.
- Raw-HTML insertion is forbidden by lint; every backend or user text is shown as a text node; addresses are built in one place with encoding.
- A build check fails on any host name or port in the built plugin, and a lock-file check fails on any package outside the tech stack list.

## Q1. [Performance] How should dates and times be shown?

Why we ask: the audit log and the decision block show when things happened. The format is visible on every screen and tests must give the same text every run. Recommendation: A, because the time matches the person's own clock and the format never changes with the browser's language.

- A. Year-month-day and hours:minutes in the viewer's own time zone, for example `2026-11-08 14:05`; no relative times such as "5 minutes ago"
- B. The same format but always in UTC, with the label "UTC", so everyone sees the same time
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Dates and times show as year-month-day and hours:minutes in the viewer's own time zone, with no relative times (Q1: A)
- Design choices set without asking: every section loads on its own at mount and stale answers are dropped; a page timeout is treated as a lost connection; "Working..." shows in the same render and a second press is ignored; one token refresh and one repeated read after a 401, writes never repeated; plan and CI paged in the browser and audit paged by the backend; screens lazy-loaded by route; raw-HTML insertion forbidden by lint with all texts shown as text; one address builder with encoding; build checks for host names or ports and for packages outside the tech stack list

- Looks correct
- Request changes

[Answer]: Looks correct
