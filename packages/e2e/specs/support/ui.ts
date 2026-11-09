import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { UserKey } from './api';
import { USERS } from './api';

// The sign-in is held in memory only (u4, NFR5.3), so a full page load always
// starts at the sign-in page: the helpers below open an address and sign in
// there, and every later move inside a test is made by clicking.

export const servicePath = (service: string) =>
  `/catalog/default/component/${service}/guardrails`;

export const signInButton = (page: Page, user: UserKey) =>
  page.getByRole('button', { name: `Sign in as ${USERS[user].name}` });

/** Opens an address; the sign-in page shows first. */
export async function openSignIn(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(signInButton(page, 'sam')).toBeVisible();
}

/** Opens the Guardrails tab of a service as a user and waits for its plan. */
export async function openService(
  page: Page,
  user: UserKey,
  service: string,
): Promise<void> {
  await openSignIn(page, servicePath(service));
  await signInButton(page, user).click();
  await expect(
    page.getByRole('heading', { name: 'Dependency upgrade plan' }),
  ).toBeVisible();
}

/** Switches the demo user with the menu of the Guardrails view. */
export async function switchUser(page: Page, user: UserKey): Promise<void> {
  await page.getByTestId('switch-user').click();
  await page
    .getByRole('menuitem', { name: new RegExp(`^${USERS[user].name},`) })
    .click();
  await expect(page.getByTestId('switch-user')).toContainText(USERS[user].name);
}
