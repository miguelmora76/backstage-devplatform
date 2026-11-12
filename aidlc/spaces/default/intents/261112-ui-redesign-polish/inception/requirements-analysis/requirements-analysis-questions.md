# Requirements Analysis Questions

Sources: [desc] the initial description (UI redesign, fix and polish, one dark theme, Chrome and Safari, same screens and behaviour, keep accessibility and the 85% coverage floor); the code knowledge base from Reverse Engineering (the Backstage stylesheet is never loaded; no theme extension; the app has exactly three features asserted by a test).

## Q1. [Product] Should the app be dark only, or also offer a light theme?
Today the app follows Backstage's default theme choice, so dark is not guaranteed. You asked for the same dark look the Guardrails tab has now.

A. Dark only: one dark theme, always, with no switch (simplest, most consistent)
B. Dark by default, with Backstage's usual light/dark choice kept so a person can switch
X. Other (please specify)

[Answer]: B

## Q2. [Product] Is there a colour or brand accent you want?
The pages need one accent colour for links, buttons and the selected tab, and status colours (ready, warning, failed) for the Guardrails views. Status will always be shown with text as well as colour.

A. Keep Backstage's usual look (its default dark palette and accent)
B. I choose a sober, professional palette and show you screenshots before it is committed
X. Other (please specify)

[Answer]: A

## Q3. [Engineering] May the app take Backstage's UI package as a direct dependency?
The missing stylesheet belongs to a package (`@backstage/ui`) that is installed today only indirectly. Importing its stylesheet is the main fix, and it means listing the package in the app's package file and in the repository's allow-list of packages.

A. Yes, add it as a direct dependency and to the allow-list (recommended: it is the supported way)
B. No new dependencies: write the needed styles ourselves in the app
X. Other (please specify)

[Answer]: A

## Q4. [Quality] How should Safari be checked?
Today the automated browser checks run Chrome and Firefox only; Safari is checked by hand. Adding a WebKit browser to the end-to-end checks approximates Safari in the pipeline but makes the live job longer and adds a new browser to keep stable.

A. By hand: you look at it in Safari before the work is approved; no new automated browser
B. Add a WebKit run of the existing view checks to the pipeline as well
X. Other (please specify)

[Answer]: A
