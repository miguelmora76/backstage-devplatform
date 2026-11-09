import { expect, test, type Page } from '@playwright/test';
import { seededDependencies } from './support/seed';
import { openSignIn } from './support/ui';

// NFR3.2: the main task - sign in, propose a change, sign in as another user,
// approve it with a reason, open the audit log - is done with key events only
// (no pointer), in Chrome and Firefox; focus moves into the detail that opens
// and lands on a sensible element after the decision.
const SERVICE_OF: Record<string, string> = {
  chrome: 'notify-console',
  firefox: 'inventory-bridge',
};

/** What has focus, as a name a person would hear. */
async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return '';
    return (
      el.getAttribute('aria-label') ||
      (el as HTMLInputElement).labels?.[0]?.textContent ||
      el.textContent ||
      el.tagName
    ).trim();
  });
}

/** Presses Tab until the focused element's name matches; fails after `limit` presses. */
async function tabTo(page: Page, name: string | RegExp, limit = 150) {
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press('Tab');
    const current = await focused(page);
    if (typeof name === 'string' ? current === name : name.test(current)) {
      return current;
    }
  }
  throw new Error(`Never reached "${name}" with the Tab key`);
}

test('propose, approve with a reason and read the audit log with the keyboard only', async ({
  page,
}, info) => {
  const service = SERVICE_OF[info.project.name];
  const dependency = seededDependencies(service)
    .filter(d => d.currentVersion !== d.recommendedVersion)
    .map(d => d.name)
    .sort()[0];

  // Sign in as Sam.
  await openSignIn(page, `/catalog/default/component/${service}/guardrails`);
  await tabTo(page, 'Sign in as Sam');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Dependency upgrade plan' }),
  ).toBeVisible();

  // Propose a change.
  await tabTo(page, `Propose change for ${dependency}`);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Change proposed.').first()).toBeVisible();

  // Switch to Priya through the menu.
  await tabTo(page, /^Switch demo user/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  for (let i = 0; i < 3; i += 1) {
    if ((await focused(page)).startsWith('Priya')) break;
    await page.keyboard.press('ArrowDown');
  }
  expect(await focused(page)).toMatch(/^Priya/);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('switch-user')).toContainText('Priya');
  expect(await focused(page)).toMatch(/^Switch demo user, signed in as Priya/);

  // Open the change: focus must land inside the detail.
  await tabTo(page, new RegExp(`^View change: Upgrade ${dependency} `));
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Reason (required)')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => document.activeElement !== document.body),
    )
    .toBe(true);

  // Approve with a reason.
  await tabTo(page, 'Reason (required)');
  await page.keyboard.type('checked by keyboard');
  await tabTo(page, 'Approve');
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('Change approved and applied.').first(),
  ).toBeVisible();

  // After the decision focus is on a real element, and the audit log can be read.
  await expect
    .poll(async () =>
      page.evaluate(() => document.activeElement !== document.body),
    )
    .toBe(true);
  const audit = page.getByRole('region', { name: 'Audit log' });
  await expect(
    audit.getByRole('cell', { name: 'Priya' }).first(),
  ).toBeVisible();
  await tabTo(page, 'Clear filters');
  await page.keyboard.press('Tab');
  expect(await focused(page)).not.toBe('');
});
