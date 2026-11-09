import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { client, signIn } from './api';
import { seededFailedRuns } from './seed';
import { openSignIn, servicePath, signInButton } from './ui';

// The six views of the sample and the data-ready marker of each: a visible
// element that exists only once the view's data is rendered (NFR1.1). One
// file holds them, so the accessibility scan, the accessibility tree and the
// timing check all look at the same screens.

/** A service with both upgrade candidates and failed runs; the proposals made here are re-runs. */
export const SHOWCASE = 'checkout-bridge';

export interface Prepared {
  service: string;
  changeId: string;
}

/**
 * Makes sure the showcase service has at least three open changes (re-runs of
 * its first failed runs) so that the lists have rows.
 */
export async function prepareChanges(
  request: APIRequestContext,
): Promise<Prepared> {
  const sam = client(request, await signIn(request, 'sam'));
  const openNow = async () =>
    ((await sam.changes(SHOWCASE, 'open')).body.items as Array<{
      changeId: string;
    }>) ?? [];
  let open = await openNow();
  // Only the missing proposals are made, so a repeated call adds nothing.
  for (const run of seededFailedRuns(SHOWCASE).slice(0, 3 - open.length)) {
    const response = await sam.propose(SHOWCASE, 'rerun', run.runKey);
    if (response.status !== 201 && response.status !== 409) {
      throw new Error(`Could not propose ${run.runKey}: ${response.status}`);
    }
  }
  open = await openNow();
  if (open.length < 3) {
    throw new Error(`Expected three open changes, found ${open.length}`);
  }
  return { service: SHOWCASE, changeId: open[0].changeId };
}

export interface View {
  name: string;
  /** Navigates to the view (signing in as needed) and waits for its marker. */
  show(page: Page): Promise<void>;
}

export function views({ service, changeId }: Prepared): View[] {
  const run = seededFailedRuns(service)[0];
  const overview = async (page: Page) => {
    await openSignIn(page, servicePath(service));
    await signInButton(page, 'sam').click();
  };
  return [
    {
      name: 'sign-in choices',
      async show(page) {
        await page.goto('/');
        for (const name of ['Sam', 'Priya', 'Alex']) {
          await expect(
            page.getByRole('button', { name: `Sign in as ${name}` }),
          ).toBeVisible();
        }
      },
    },
    {
      name: 'catalog list',
      async show(page) {
        await openSignIn(page, '/catalog');
        await signInButton(page, 'sam').click();
        await expect(
          page.getByRole('link', { name: 'checkout-bridge' }),
        ).toBeVisible();
        // The list is drawn while a progress indicator without a name is shown
        // (axe aria-progressbar-name); scan only when loading has finished.
        await expect(page.getByRole('progressbar')).toHaveCount(0);
        // The app repairs the list's markup after it renders (a11y/catalogA11y);
        // wait for the repaired state so the scan never sees the unrepaired one.
        await expect(
          page.locator('[role="combobox"]:not([aria-label])'),
        ).toHaveCount(0);
        await expect(
          page.locator('th [role="button"] [role="button"]'),
        ).toHaveCount(0);
        await expect(
          page.getByRole('link', {
            name: /^(catalog-portal|checkout-bridge|inventory-bridge|notify-console|profile-sync|profile-worker)$/,
          }),
        ).toHaveCount(6);
      },
    },
    {
      name: 'service overview',
      async show(page) {
        await overview(page);
        await expect(
          page.getByRole('button', { name: /^Propose change for / }).first(),
        ).toBeVisible();
        await expect(
          page.getByRole('button', {
            name: `Propose re-run for build ${run.runNumber}`,
          }),
        ).toBeVisible();
      },
    },
    {
      name: 'changes list',
      async show(page) {
        await overview(page);
        await expect(
          page.getByRole('link', { name: /^View change: / }).nth(2),
        ).toBeVisible();
      },
    },
    {
      name: 'change detail',
      async show(page) {
        await openSignIn(page, `${servicePath(service)}/changes/${changeId}`);
        await signInButton(page, 'priya').click();
        await expect(
          page.getByRole('button', { name: 'Approve' }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Reject' }),
        ).toBeVisible();
        await expect(
          page.getByRole('heading', { level: 1 }).first(),
        ).toBeVisible();
      },
    },
    {
      name: 'audit log',
      async show(page) {
        await overview(page);
        const audit = page.getByRole('region', { name: 'Audit log' });
        await expect(audit.getByRole('row')).not.toHaveCount(0);
        await expect(
          audit.getByRole('cell', { name: 'Sam' }).first(),
        ).toBeVisible();
      },
    },
  ];
}
