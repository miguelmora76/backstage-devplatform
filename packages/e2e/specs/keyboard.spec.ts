import { expect, test, type Page } from '@playwright/test';
import { waitForHealthyStack } from './support/healthy';
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

test.beforeAll(async ({ playwright }) => {
  // Starts from a stack that really answers (an earlier spec may have ended
  // the guardrails server).
  const request = await playwright.request.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:7007',
  });
  await waitForHealthyStack(request);
  await request.dispose();
});

/**
 * Page-side helpers, installed before every page load: the name of an element
 * as a person would hear it, and the last element that had focus (focus can be
 * lost to the page body when a button is replaced after it is used).
 */
function installFocusTracking(page: Page) {
  return page.addInitScript(() => {
    const w = window as unknown as {
      __nameOf: (el: HTMLElement) => string;
      __last?: Element;
    };
    w.__nameOf = el =>
      (
        el.getAttribute('aria-label') ||
        (el as HTMLInputElement).labels?.[0]?.textContent ||
        el.textContent ||
        el.tagName
      ).trim();
    document.addEventListener(
      'focusin',
      event => {
        w.__last = event.target as Element;
      },
      true,
    );
  });
}

/** What has focus, as a name a person would hear; empty when nothing has. */
async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return '';
    return (window as unknown as { __nameOf(e: HTMLElement): string }).__nameOf(
      el,
    );
  });
}

const matches = (name: string | RegExp, current: string) =>
  typeof name === 'string' ? current === name : name.test(current);

/**
 * Which key leads to the control: the page is asked only where the control is
 * relative to the focus (before or after it in the document); the control
 * itself is reached with key presses alone. When focus was lost to the body
 * and the last focused element is gone, both directions are tried.
 */
async function directionTo(page: Page, name: string | RegExp) {
  const pattern =
    typeof name === 'string'
      ? {
          source: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          flags: '',
        }
      : { source: name.source, flags: name.flags };
  return page.evaluate(({ source, flags }) => {
    const w = window as unknown as {
      __nameOf(e: HTMLElement): string;
      __last?: Element;
    };
    const re = new RegExp(source, flags);
    const target = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]',
      ),
    ).find(el => el.tabIndex >= 0 && re.test(w.__nameOf(el)));
    const active = document.activeElement;
    const from = active && active !== document.body ? active : w.__last;
    if (!target || !from || !document.contains(from)) return 'unknown';
    if (from === target) return 'here';
    return from.compareDocumentPosition(target) &
      Node.DOCUMENT_POSITION_FOLLOWING
      ? 'forward'
      : 'backward';
  }, pattern);
}

/**
 * Moves focus to the control with Tab or Shift+Tab only. The direction is
 * chosen from the document order; the other direction is tried as well. A
 * failure lists the last ten focused names, so a CI failure can be read.
 */
async function tabTo(page: Page, name: string | RegExp, limit = 100) {
  const direction = await directionTo(page, name);
  if (direction === 'here' && matches(name, await focused(page))) {
    return focused(page);
  }
  const keys =
    direction === 'backward' ? ['Shift+Tab', 'Tab'] : ['Tab', 'Shift+Tab'];
  const history: string[] = [];
  for (const key of keys) {
    for (let i = 0; i < limit; i += 1) {
      await page.keyboard.press(key);
      const current = await focused(page);
      history.push(`${key}: ${current || '(nothing)'}`);
      if (matches(name, current)) {
        return current;
      }
    }
  }
  throw new Error(
    `Never reached "${name}" with Tab or Shift+Tab (direction hint: ${direction}, page ${page.url()}). Last focused: ${history
      .slice(-10)
      .join(' | ')}`,
  );
}

test('propose, approve with a reason and read the audit log with the keyboard only', async ({
  page,
}, info) => {
  const service = SERVICE_OF[info.project.name];
  const dependency = seededDependencies(service)
    .filter(d => d.currentVersion !== d.recommendedVersion)
    .map(d => d.name)
    .sort()[0];

  await installFocusTracking(page);

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
