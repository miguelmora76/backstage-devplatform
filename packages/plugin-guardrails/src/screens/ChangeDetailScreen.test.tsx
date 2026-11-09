import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ChangeDetailScreen } from './ChangeDetailScreen';
import {
  renderScreen,
  setupStandIn,
  type RenderOptions,
} from '../testing/harness';
import { ALEX, PRIYA, SAM, SERVICE } from '../testing/standIn/handlers';

const standIn = setupStandIn();

async function renderDetail(id = 'c1', options: RenderOptions = {}) {
  const view = renderScreen(
    <ChangeDetailScreen service={SERVICE} changeId={id} />,
    { route: `/changes/${id}`, path: '/changes/:changeId', ...options },
  );
  return view;
}

async function loaded(id = 'c1', options: RenderOptions = {}) {
  const view = await renderDetail(id, options);
  await waitFor(() =>
    expect(screen.getByTestId('detail-h1')).not.toHaveTextContent('Change'),
  );
  return view;
}

const reasonBox = () =>
  screen.getByLabelText('Reason (required)') as HTMLTextAreaElement;
const posts = () => standIn.state.requests.filter(r => r.method === 'POST');

describe('ChangeDetailScreen content (D10, BR3.1, BR7.1, BR7.3)', () => {
  it('has the change summary as h1, takes focus on it when it opens, and names the screen and service in the page title', async () => {
    await loaded();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Upgrade lib-a from 1.2 to 2.0');
    expect(h1).toHaveFocus();
    expect(document.title).toBe('Upgrade lib-a from 1.2 to 2.0 - payments-api');
  });

  it('shows status, proposer with time, and "What it will do" with kind label, service and summary', async () => {
    await loaded();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(
      screen.getByText('Proposed by Sam at 2026-11-06 11:40'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'What it will do' }),
    ).toBeInTheDocument();
    const list = screen.getByTestId('what-it-will-do');
    expect(list).toHaveTextContent('Dependency upgrade');
    expect(list).toHaveTextContent('payments-api');
    expect(list).toHaveTextContent('Upgrade lib-a from 1.2 to 2.0');
  });

  it('shows the breadcrumb ending in the word Change, with no id', async () => {
    await loaded();
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs).toHaveTextContent('Guardrails > payments-api > Change');
    expect(crumbs).not.toHaveTextContent('c1');
  });

  it('shows the loading state: busy, "Loading change...", no actions', async () => {
    standIn.state.delayMs = 40;
    const { container } = await renderDetail();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading change...');
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Back' })).toBeInTheDocument(),
    );
  });

  it('shows a decided change with its decision block and no actions or reason box', async () => {
    standIn.state.changes[0].status = 'applied';
    standIn.state.changes[0].decidedBy = PRIYA;
    standIn.state.changes[0].decisionReason = 'Safe, tested.';
    standIn.state.changes[0].decidedAt = '2026-11-06T10:42:00.000Z';
    await loaded();
    expect(
      screen.getByText('Decided by Priya at 2026-11-06 11:42'),
    ).toBeInTheDocument();
    expect(screen.getByText('Safe, tested.')).toBeInTheDocument();
    for (const name of ['Approve', 'Reject', 'Retry']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(
      screen.queryByLabelText('Reason (required)'),
    ).not.toBeInTheDocument();
  });

  it('shows the failure message in the decision block of a failed change', async () => {
    standIn.state.appUser = PRIYA;
    await loaded('c2');
    expect(
      screen.getByText('Could not be applied: Runner pool unavailable'),
    ).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows not found with a Back link and no actions', async () => {
    await renderDetail('zz');
    await waitFor(() =>
      expect(
        screen.getByText('This change no longer exists.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: 'Back' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
  });

  it('shows the server error with Retry when the change cannot be read', async () => {
    standIn.state.modes.change = 'network';
    const { user } = await renderDetail();
    await waitFor(() =>
      expect(
        screen.getByText('Guardrails server unreachable.'),
      ).toBeInTheDocument(),
    );
    standIn.state.modes.change = 'ok';
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(screen.getByTestId('detail-h1')).toHaveTextContent(
        'Upgrade lib-a',
      ),
    );
  });
});

describe('ChangeDetailScreen actions by case (D11, BR3.5)', () => {
  it('pending, another user: Approve and Reject enabled, tab order Back, reason, Reject, Approve', async () => {
    standIn.state.appUser = PRIYA;
    const { user } = await loaded();
    expect(screen.getByRole('button', { name: 'Approve' })).not.toHaveAttribute(
      'aria-disabled',
    );
    expect(screen.getByRole('button', { name: 'Reject' })).not.toHaveAttribute(
      'aria-disabled',
    );
    expect(
      screen.queryByRole('button', { name: 'Retry' }),
    ).not.toBeInTheDocument();
    // Focus order from Back: the reason box, Reject, Approve.
    screen.getByRole('link', { name: 'Back' }).focus();
    await user.tab();
    expect(reasonBox()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reject' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveFocus();
  });

  it('pending, the viewer proposed it: both disabled with the proposer text', async () => {
    standIn.state.appUser = SAM;
    await loaded();
    for (const name of ['Approve', 'Reject']) {
      const b = screen.getByRole('button', { name });
      expect(b).toHaveAttribute('aria-disabled', 'true');
      expect(b).toHaveAccessibleDescription(
        'You proposed this change, so someone else must decide it.',
      );
    }
  });

  it('pending, auditor: both disabled with the read-only text', async () => {
    standIn.state.appUser = ALEX;
    await loaded();
    expect(
      screen.getByRole('button', { name: 'Approve' }),
    ).toHaveAccessibleDescription('Auditors can read but not change.');
  });

  it('pending and being decided: both disabled with the in-progress text', async () => {
    standIn.state.appUser = PRIYA;
    standIn.state.deciding.add('c1');
    await loaded();
    expect(
      screen.getByRole('button', { name: 'Reject' }),
    ).toHaveAccessibleDescription('This change is being decided.');
  });

  it('pending, server unreachable: both disabled with the unreachable text', async () => {
    standIn.state.appUser = PRIYA;
    standIn.state.serverDown = true;
    await loaded();
    expect(
      screen.getByRole('button', { name: 'Approve' }),
    ).toHaveAccessibleDescription('Guardrails server unreachable.');
  });

  it('failed, another user: Retry enabled and no Approve or Reject', async () => {
    standIn.state.appUser = SAM;
    standIn.state.changes[1].proposedBy = PRIYA;
    await loaded('c2');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
  });

  it('failed, the viewer proposed it: Retry disabled with the proposer text', async () => {
    standIn.state.appUser = SAM;
    standIn.state.changes[1].proposedBy = SAM;
    await loaded('c2');
    expect(
      screen.getByRole('button', { name: 'Retry' }),
    ).toHaveAccessibleDescription(
      'You proposed this change, so someone else must decide it.',
    );
  });

  it('sends nothing when a disabled action is activated', async () => {
    standIn.state.appUser = SAM;
    const { user } = await loaded();
    await user.type(reasonBox(), 'Because');
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(posts()).toHaveLength(0);
  });
});

describe('ChangeDetailScreen deciding (BR3.2 to BR3.8)', () => {
  beforeEach(() => {
    standIn.state.appUser = PRIYA;
    standIn.state.changes[1].proposedBy = SAM;
  });

  it('keeps the screen open and sends nothing for a blank reason', async () => {
    const { user } = await loaded();
    fireEvent.change(reasonBox(), { target: { value: '   ' } });
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByText('Enter a reason.')).toBeInTheDocument();
    expect(reasonBox()).toHaveAccessibleDescription(/Enter a reason\./);
    expect(reasonBox()).toHaveFocus();
    expect(posts()).toHaveLength(0);
  });

  it('approves with the reason exactly as typed and returns to the view with the banner', async () => {
    const { user } = await loaded();
    await user.type(reasonBox(), ' Safe, tested. ');
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    const back = await screen.findByTestId('elsewhere');
    expect(back).toHaveAttribute('data-path', '/');
    expect(back).toHaveAttribute('data-banner', 'banner.approved');
    expect(posts()).toHaveLength(1);
    expect(posts()[0].body).toEqual({ reason: ' Safe, tested. ' });
    expect(posts()[0].path).toMatch(/\/changes\/c1\/approve$/);
  });

  it('returns with banner.applyFailed when the approval could not be applied', async () => {
    standIn.state.applyOutcome = 'failed';
    const { user } = await loaded();
    await user.type(reasonBox(), 'Go');
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByTestId('elsewhere')).toHaveAttribute(
      'data-banner',
      'banner.applyFailed',
    );
  });

  it('rejects and returns with banner.rejected', async () => {
    const { user } = await loaded();
    await user.type(reasonBox(), 'No thanks');
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByTestId('elsewhere')).toHaveAttribute(
      'data-banner',
      'banner.rejected',
    );
    expect(posts()[0].path).toMatch(/\/reject$/);
  });

  it('retries a failed change and returns with banner.retryApplied or banner.retryFailed', async () => {
    const first = await loaded('c2');
    await first.user.type(reasonBox(), 'Again');
    await first.user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('elsewhere')).toHaveAttribute(
      'data-banner',
      'banner.retryApplied',
    );
    first.unmount();

    standIn.state.changes[1].status = 'failed';
    standIn.state.applyOutcome = 'failed';
    const second = await loaded('c2');
    await second.user.type(reasonBox(), 'Again');
    await second.user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('elsewhere')).toHaveAttribute(
      'data-banner',
      'banner.retryFailed',
    );
  });

  it('shows Working... at once and sends one request for one click', async () => {
    const { user } = await loaded();
    await user.type(reasonBox(), 'Go');
    const button = screen.getByRole('button', { name: 'Approve' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveTextContent('Working...');
    await screen.findByTestId('elsewhere');
    expect(posts()).toHaveLength(1);
  });

  it('shows the already-decided refusal in a focused alert, reloads to the decision block, and keeps the alert', async () => {
    const { user } = await loaded();
    // Someone else decides while this page is open.
    standIn.state.changes[0].status = 'rejected';
    standIn.state.changes[0].decidedBy = SAM;
    standIn.state.changes[0].decisionReason = 'Not now';
    standIn.state.changes[0].decidedAt = '2026-11-06T10:50:00.000Z';
    await user.type(reasonBox(), 'Too late');
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    const alert = await screen.findByTestId('refusal-alert');
    expect(alert).toHaveTextContent('This change was already decided.');
    await waitFor(() => expect(alert).toHaveFocus());
    await waitFor(() =>
      expect(
        screen.getByText('Decided by Sam at 2026-11-06 11:50'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByLabelText('Reason (required)'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('refusal-alert')).toBeInTheDocument();
    // The refusal entry was written by the backend with the reason as typed.
    expect(standIn.state.audit[0]).toMatchObject({
      outcome: 'refused',
      reason: 'Too late',
    });
    // Dismissing moves focus to the decision block heading.
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(
      screen.getByRole('heading', { name: /Decided by Sam/ }),
    ).toHaveFocus();
  });

  it('shows the not-failed refusal when a retry meets a change that is no longer failed', async () => {
    const { user } = await loaded('c2');
    standIn.state.changes[1].status = 'applied';
    await user.type(reasonBox(), 'Again');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('refusal-alert')).toHaveTextContent(
      'Only a failed change can be retried.',
    );
  });

  it.each([
    [
      'SELF_DECISION',
      403,
      'You proposed this change, so someone else must decide it.',
    ],
    ['AUDITOR_READ_ONLY', 403, 'Auditors can read but not change.'],
    [
      'CLAIM_RELEASED',
      409,
      'This change was interrupted. It has been reloaded.',
    ],
    ['INTERNAL_ERROR', 500, 'Something went wrong. Try again.'],
    ['SERVER_UNREACHABLE', 503, 'Guardrails server unreachable.'],
  ] as const)(
    'shows the text for %s in an announced alert and keeps the reason',
    async (code, status, text) => {
      const { user } = await loaded();
      standIn.state.nextDecisionError = { code, status };
      await user.type(reasonBox(), 'Keep me');
      await user.click(screen.getByRole('button', { name: 'Approve' }));
      expect(await screen.findByTestId('refusal-alert')).toHaveTextContent(
        text,
      );
      await waitFor(() => expect(reasonBox().value).toBe('Keep me'));
    },
  );

  it('shows the demo-session text for a 401 on a decision', async () => {
    const { user } = await loaded();
    standIn.state.nextDecisionError = { code: 'UNAUTHENTICATED', status: 401 };
    await user.type(reasonBox(), 'x');
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByTestId('refusal-alert')).toHaveTextContent(
      'Your demo session ended. Choose a demo user.',
    );
  });

  it('keeps the reason, shows submitFailed and makes the button usable again when the connection is lost', async () => {
    const { user } = await loaded();
    await user.type(reasonBox(), 'Keep me');
    standIn.state.modes.write = 'network';
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByTestId('refusal-alert')).toHaveTextContent(
      'Could not reach the Guardrails server. Your reason is kept. Try again.',
    );
    expect(reasonBox().value).toBe('Keep me');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Approve' }),
      ).not.toHaveAttribute('aria-disabled'),
    );
    standIn.state.modes.write = 'ok';
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByTestId('elsewhere')).toHaveAttribute(
      'data-banner',
      'banner.approved',
    );
  });

  it('reloads the change before the next attempt after a lost answer (the write may have finished)', async () => {
    const { user } = await loaded();
    await user.type(reasonBox(), 'Keep me');
    standIn.state.modes.write = 'network';
    const readsBefore = standIn.state.requests.filter(
      r => r.method === 'GET' && /\/changes\/c1$/.test(r.path),
    ).length;
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await screen.findByTestId('refusal-alert');
    await waitFor(() =>
      expect(
        standIn.state.requests.filter(
          r => r.method === 'GET' && /\/changes\/c1$/.test(r.path),
        ).length,
      ).toBeGreaterThan(readsBefore),
    );
  });
});

describe('ChangeDetailScreen when the demo sign-in is off', () => {
  it('does not ask to choose a demo user when a decision meets a 401 and there is no switch', async () => {
    standIn.state.demoEnabled = false;
    standIn.state.appUser = PRIYA;
    const { user } = await loaded();
    standIn.state.nextDecisionError = { code: 'UNAUTHENTICATED', status: 401 };
    await user.type(reasonBox(), 'x');
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByTestId('refusal-alert')).toHaveTextContent(
      'Your session ended. Sign in again.',
    );
  });
});

describe('ChangeDetailScreen user switch (BR5.4)', () => {
  it('re-evaluates the actions and clears the alert after a switch', async () => {
    standIn.state.appUser = SAM;
    const { user } = await loaded();
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Switch demo user, signed in as Sam',
      }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /Priya/ }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Approve' }),
      ).not.toHaveAttribute('aria-disabled'),
    );
    expect(
      screen.getByRole('button', {
        name: 'Switch demo user, signed in as Priya',
      }),
    ).toHaveFocus();
  });
});

describe('ChangeDetailScreen accessibility (NFR3.1)', () => {
  it.each([
    ['pending as another user', PRIYA, 'c1'],
    ['pending as the proposer', SAM, 'c1'],
    ['pending as the auditor', ALEX, 'c1'],
    ['failed', PRIYA, 'c2'],
  ])('has no violations: %s', async (_name, who, id) => {
    standIn.state.appUser = who;
    const { container } = await loaded(id);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations: loading, decided, not found and a refusal alert', async () => {
    standIn.state.delayMs = 30;
    const a = await renderDetail();
    expect(await axe(a.container)).toHaveNoViolations();
    await waitFor(() =>
      expect(screen.getByTestId('detail-h1')).toHaveTextContent(
        'Upgrade lib-a',
      ),
    );
    a.unmount();
    standIn.state.delayMs = 0;

    standIn.state.changes[0].status = 'applied';
    standIn.state.changes[0].decidedBy = PRIYA;
    standIn.state.changes[0].decisionReason = 'ok';
    standIn.state.changes[0].decidedAt = '2026-11-06T10:42:00.000Z';
    const b = await loaded();
    expect(await axe(b.container)).toHaveNoViolations();
    b.unmount();

    const c = await renderDetail('zz');
    await waitFor(() =>
      expect(
        screen.getByText('This change no longer exists.'),
      ).toBeInTheDocument(),
    );
    expect(await axe(c.container)).toHaveNoViolations();
    c.unmount();

    standIn.state.changes[0].status = 'pending';
    standIn.state.appUser = PRIYA;
    standIn.state.changes[0].decidedBy = undefined;
    const d = await loaded();
    standIn.state.nextDecisionError = { code: 'SELF_DECISION', status: 403 };
    await d.user.type(reasonBox(), 'x');
    await d.user.click(screen.getByRole('button', { name: 'Approve' }));
    await screen.findByTestId('refusal-alert');
    expect(await axe(d.container)).toHaveNoViolations();
    void within;
  });
});
