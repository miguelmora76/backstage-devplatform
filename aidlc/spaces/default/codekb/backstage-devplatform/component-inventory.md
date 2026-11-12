# Component Inventory

## app
Frontend host app (`packages/app`): bootstraps `createApp`, lists features, owns sign-in and the catalog accessibility repair. Depends on frontend-defaults, plugin-app, plugin-catalog, plugin-guardrails, MUI v4.

## signInModule
`packages/app/src/signInModule.tsx`: frontend module for plugin `app` with the custom sign-in page, root redirect and `CatalogA11yFix` root element.

## SignInPage
`packages/app/src/signin/SignInPage.tsx`: plain `<main>` with `Typography`, `List`, `Button` (MUI v4); state in `signInState.ts`; client in `signInClient.ts`; identity in `identityHolder.ts`. No layout wrapper.

## CatalogA11yFix
`packages/app/src/a11y/`: MutationObserver that sets ARIA attributes on Backstage's catalog table, filters and drag handles after render.

## plugin-guardrails
Frontend plugin (`packages/plugin-guardrails`): `plugin.tsx` registers API, tab and card.

## GuardrailsView
Screen B (`screens/GuardrailsView.tsx`): header, banners, two-column auto-fit grid (`minmax(420px, 1fr)`) of Upgrade plan and CI triage, then open changes and audit log.

## ChangeDetailScreen
Screen C (`screens/ChangeDetailScreen.tsx`): change detail, decision block, approve/reject forms.

## GuardrailsHeader
Header with `ShieldMark`, breadcrumbs, signed-in user and `DemoUserSwitch`.

## SectionFrame
MUI `Paper` section wrapper (padding 16, `minWidth: 0`) used by all four sections.

## StatusLabel
Icon plus word status with fixed light-theme colours (#8a5a00, #1b6e2d, #9b1c1c, #1f3a93).

## ShieldMark
Placeholder SVG, fill #1F3A93, replaceable in one place.

## GuardrailsOverviewCard
Entity info card (`components/GuardrailsOverviewCard.tsx`), MUI Paper with inline layout.

## PagedTable
MUI table with visually hidden caption and paging (`components/PagedTable.tsx`).

## backend
Backstage backend entry and feature list (`packages/backend`).

## plugin-guardrails-backend
Router, change workflow, stores, rules, demo sign-in (`packages/plugin-guardrails-backend`).

## guardrails-server
Tool server and data generator (`packages/guardrails-server`).

## e2e
Playwright specs and stack/repo checks (`packages/e2e`).
