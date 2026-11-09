import { screen, waitFor, within } from '@testing-library/react';
import { GuardrailsRoutes } from '../screens/GuardrailsRoutes';
import { renderScreen, setupStandIn } from '../testing/harness';
import { PRIYA, SERVICE } from '../testing/standIn/handlers';
import { t } from '../texts/texts';

// NFR3.2, NFR3.3: the seven walkthroughs of the accessibility checklist are
// driven with keyboard events only (Tab, Shift+Tab, Enter, Space, arrows,
// Escape), and what assistive technology is told equals the catalog text.
const standIn = setupStandIn();

function app() {
  return renderScreen(<GuardrailsRoutes service={SERVICE} />, {
    route: '/',
    path: '/*',
  });
}

/** Tabs forward until the element with this accessible name has focus. */
async function tabTo(
  user: ReturnType<typeof renderScreen>['user'],
  matches: (el: HTMLElement) => boolean,
  limit = 120,
) {
  for (let i = 0; i < limit; i += 1) {
    await user.tab();
    const el = document.activeElement as HTMLElement;
    if (el && matches(el)) return el;
  }
  throw new Error('Never reached the control with the keyboard');
}

const named = (name: string) => (el: HTMLElement) =>
  el.getAttribute('aria-label') === name ||
  (el.textContent?.trim() === name && el.getAttribute('aria-label') === null);

describe('keyboard walkthroughs', () => {
  it('1. open the view and read it: every section and control is reachable in page order', async () => {
    const { user } = app();
    await screen.findByText('Page 1 of 3');
    const seen: string[] = [];
    for (let i = 0; i < 60; i += 1) {
      await user.tab();
      const el = document.activeElement as HTMLElement;
      if (el === document.body) break;
      seen.push(el.getAttribute('aria-label') ?? el.textContent ?? el.tagName);
    }
    const idx = (name: string) => seen.findIndex(s => s.includes(name));
    expect(idx('Switch demo user')).toBeGreaterThanOrEqual(0);
    expect(idx('Propose change for lib-a')).toBeGreaterThan(
      idx('Switch demo user'),
    );
    expect(idx('Propose re-run for build 41')).toBeGreaterThan(
      idx('Propose change for lib-a'),
    );
    expect(idx('View change')).toBeGreaterThan(
      idx('Propose re-run for build 41'),
    );
    expect(idx('Clear filters')).toBeGreaterThan(idx('View change'));
    // The audit log's Next is the last paging control on the page.
    expect(seen.map(x => x.includes('Next')).lastIndexOf(true)).toBeGreaterThan(
      idx('Clear filters'),
    );
  });

  it('2. propose a change with Enter and see the banner take focus', async () => {
    const { user } = app();
    await screen.findByText('Page 1 of 3');
    await tabTo(user, named('Propose change for lib-b'));
    await user.keyboard('{Enter}');
    const banner = await screen.findByTestId('result-banner');
    expect(banner).toHaveFocus();
    expect(banner).toHaveTextContent(t('banner.proposed'));
  });

  it('3. propose a re-run with Space', async () => {
    const { user } = app();
    await screen.findByText('Page 1 of 3');
    await tabTo(user, named('Propose re-run for build 39'));
    await user.keyboard(' ');
    expect(await screen.findByTestId('result-banner')).toHaveTextContent(
      t('banner.proposed'),
    );
  });

  it('4. open a change, enter a reason, approve with the keyboard, and land on the banner', async () => {
    standIn.state.appUser = PRIYA;
    const { user } = app();
    await screen.findByText('Page 1 of 3');
    await tabTo(
      user,
      el =>
        el.getAttribute('aria-label') ===
        'View change: Upgrade lib-a from 1.2 to 2.0',
    );
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByTestId('detail-h1')).toHaveFocus());
    const reason = await tabTo(user, el => el.tagName === 'TEXTAREA');
    await user.keyboard('Looks safe');
    expect(reason).toHaveValue('Looks safe');
    await tabTo(user, named('Approve'));
    await user.keyboard('{Enter}');
    const banner = await screen.findByTestId('result-banner');
    expect(banner).toHaveFocus();
    expect(banner).toHaveTextContent(t('banner.approved'));
  });

  it('5. reject with the keyboard and an empty reason is stopped with a linked error', async () => {
    standIn.state.appUser = PRIYA;
    const { user } = app();
    await screen.findByText('Page 1 of 3');
    await tabTo(
      user,
      el =>
        el.getAttribute('aria-label') ===
        'View change: Upgrade lib-a from 1.2 to 2.0',
    );
    await user.keyboard('{Enter}');
    await screen.findByTestId('reason');
    await tabTo(user, named('Reject'));
    await user.keyboard('{Enter}');
    const box = screen.getByLabelText(t('label.reason'));
    expect(box).toHaveFocus();
    expect(box).toHaveAccessibleDescription(
      new RegExp(t('error.reasonRequired')),
    );
  });

  it('6. switch the demo user with Enter, arrows and Escape; focus returns to the button', async () => {
    const { user } = app();
    await screen.findByText('Page 1 of 3');
    const button = await tabTo(user, el =>
      (el.getAttribute('aria-label') ?? '').startsWith('Switch demo user'),
    );
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() =>
      expect(
        screen.getByText(t('status.signedIn', { name: 'Priya' })),
      ).toBeInTheDocument(),
    );
  });

  it('7. recover from a server outage with Retry by keyboard', async () => {
    standIn.state.serverDown = true;
    const { user } = app();
    const plan = await screen.findByRole('region', { name: t('section.plan') });
    await within(plan).findByText(t('error.unreachable'));
    standIn.state.serverDown = false;
    await tabTo(user, el => el.textContent === 'Retry' && plan.contains(el));
    await user.keyboard('{Enter}');
    expect(
      await within(plan).findByRole('cell', { name: 'lib-a' }),
    ).toBeInTheDocument();
  });
});

describe('what assistive technology is told equals the catalog (NFR3.3)', () => {
  it('disabled actions, banners, alerts, the counter and the paging use the catalog text', async () => {
    standIn.state.appUser = PRIYA;
    const { user } = app();
    await screen.findByText('Page 1 of 3');
    // Disabled action: the reason is its accessible description.
    const lib = screen.getByRole('button', {
      name: 'Propose change for lib-c',
    });
    expect(lib).toHaveAccessibleDescription(t('disabled.alreadyCurrent'));
    // Banner is a status region with the catalog text.
    await user.click(
      screen.getByRole('button', { name: 'Propose change for lib-b' }),
    );
    expect(
      await screen
        .findByRole('status', { name: '' })
        .catch(() => screen.getByTestId('result-banner')),
    ).toBeDefined();
    expect(screen.getByTestId('result-banner')).toHaveTextContent(
      t('banner.proposed'),
    );
    expect(screen.getByTestId('result-banner')).toHaveAttribute(
      'role',
      'status',
    );
    // Paging is announced politely.
    expect(screen.getByText(t('label.pageOf', { n: 1, m: 3 }))).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('the refusal alert and the character counter use the catalog text', async () => {
    standIn.state.appUser = PRIYA;
    const { user } = app();
    await screen.findByText('Page 1 of 3');
    await user.click(
      screen.getByRole('link', {
        name: 'View change: Upgrade lib-a from 1.2 to 2.0',
      }),
    );
    const box = await screen.findByLabelText(t('label.reason'));
    await user.type(box, 'x'.repeat(10));
    expect(screen.getByTestId('reason-count')).toHaveTextContent(
      t('status.counter', { n: 490 }),
    );
    standIn.state.nextDecisionError = { code: 'CLAIM_RELEASED', status: 409 };
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    const alert = await screen.findByTestId('refusal-alert');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(t('refusal.claimReleased'));
  });
});
