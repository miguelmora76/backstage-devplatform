import { expect, test } from '@playwright/test';
import { waitForHealthyStack } from './support/healthy';
import { prepareChanges, views, type Prepared } from './support/screens';

// NFR3.3: every interactive element has an accessible name and role in the
// real accessibility tree. The tree of each screen is read as an ARIA
// snapshot; a button, link, input, select or table without a quoted name is a
// finding, and the sign-in choices must be named "Sign in as ...".
const NAMED_ROLES = [
  'button',
  'link',
  'textbox',
  'combobox',
  'checkbox',
  'radio',
  'menuitem',
  'searchbox',
  'table',
];

const state: { prepared?: Prepared } = {};
test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:7007',
  });
  await waitForHealthyStack(request);
  state.prepared = await prepareChanges(request);
  await request.dispose();
});

/** The lines of a snapshot that name an interactive role but give it no name. */
function unnamed(snapshot: string): string[] {
  return snapshot
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      const m = /^- ([a-z]+)(?: "([^"]*)")?/.exec(line);
      return !!m && NAMED_ROLES.includes(m[1]) && !m[2];
    });
}

for (const name of [
  'sign-in choices',
  'catalog list',
  'service overview',
  'changes list',
  'change detail',
  'audit log',
]) {
  test(`${name}: every interactive element has a name`, async ({ page }) => {
    await views(state.prepared!)
      .find(v => v.name === name)!
      .show(page);
    const snapshot = await page.locator('body').ariaSnapshot();
    expect(unnamed(snapshot)).toEqual([]);
    if (name === 'sign-in choices') {
      for (const user of ['Sam', 'Priya', 'Alex']) {
        expect(snapshot).toContain(`button "Sign in as ${user}"`);
      }
    }
  });
}
