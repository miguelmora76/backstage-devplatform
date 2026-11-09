import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { GuardrailsView } from './GuardrailsView';
import { renderScreen, setupStandIn } from '../testing/harness';
import { ALEX, SERVICE } from '../testing/standIn/handlers';

const standIn = setupStandIn();

const section = (name: string) => screen.getByRole('region', { name });

async function renderView(options = {}) {
  const view = renderScreen(<GuardrailsView service={SERVICE} />, options);
  await waitFor(() =>
    expect(
      screen.getByText('Upgrade lib-a from 1.2 to 2.0'),
    ).toBeInTheDocument(),
  );
  return view;
}

describe('GuardrailsView layout and page (BR7.1)', () => {
  it('has one h1 with the service name, an h2 per section, header and main landmarks, and a page title', async () => {
    await renderView();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      SERVICE,
    );
    expect(
      screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent),
    ).toEqual([
      'Dependency upgrade plan',
      'CI failure triage',
      'Open changes',
      'Audit log',
    ]);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(document.title).toBe('Guardrails - payments-api');
  });

  it('has no accessibility violations once loaded', async () => {
    const { container } = await renderView();
    await waitFor(() =>
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument(),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('GuardrailsView sections (BR1.1, BR1.3, BR3.1, BR4.1)', () => {
  it('starts all four section loads at once (BR7.4)', async () => {
    renderScreen(<GuardrailsView service={SERVICE} />);
    await waitFor(() => {
      const paths = standIn.state.requests.map(r => r.path);
      expect(paths).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/\/plan$/),
          expect.stringMatching(/\/ci-runs$/),
          expect.stringMatching(/\/changes$/),
          expect.stringMatching(/\/audit$/),
        ]),
      );
    });
  });

  it('lists the plan with row-named propose actions', async () => {
    await renderView();
    const plan = section('Dependency upgrade plan');
    expect(
      within(plan).getByRole('columnheader', { name: 'Dependency' }),
    ).toBeInTheDocument();
    expect(
      within(plan).getByRole('cell', { name: 'lib-a' }),
    ).toBeInTheDocument();
    expect(within(plan).getByRole('cell', { name: '1.2' })).toBeInTheDocument();
    expect(within(plan).getByRole('cell', { name: '2.0' })).toBeInTheDocument();
    expect(
      within(plan).getByRole('button', { name: 'Propose change for lib-a' }),
    ).toHaveAttribute('data-testid', 'propose-lib-a');
  });

  it('disables propose for a dependency already at the recommended version, with the reason', async () => {
    await renderView();
    const button = within(section('Dependency upgrade plan')).getByRole(
      'button',
      {
        name: 'Propose change for lib-c',
      },
    );
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(
      'Already at the recommended version.',
    );
  });

  it('lists failed CI runs with the cause and a row-named re-run action', async () => {
    await renderView();
    const ci = section('CI failure triage');
    expect(within(ci).getByText('Flaky test')).toBeInTheDocument();
    expect(within(ci).getByText('Dependency conflict')).toBeInTheDocument();
    expect(
      within(ci).getByRole('button', { name: 'Propose re-run for build 41' }),
    ).toBeInTheDocument();
  });

  it('lists open changes failed first, then pending, with title, proposer, status and View', async () => {
    await renderView();
    const open = section('Open changes');
    const rows = within(open).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Re-run CI run #41 (Flaky test)');
    expect(rows[0]).toHaveTextContent('Sam');
    expect(rows[0]).toHaveTextContent('Failed');
    expect(rows[1]).toHaveTextContent('Upgrade lib-a from 1.2 to 2.0');
    expect(rows[1]).toHaveTextContent('Pending');
    expect(
      within(open).getByRole('link', {
        name: 'View change: Upgrade lib-a from 1.2 to 2.0',
      }),
    ).toHaveAttribute('href', '/changes/c1');
  });

  it('shows the audit log newest first, 10 rows, "-" for no reason', async () => {
    await renderView();
    const audit = section('Audit log');
    await waitFor(() =>
      expect(within(audit).getByText('Page 1 of 3')).toBeInTheDocument(),
    );
    expect(within(audit).getAllByRole('row')).toHaveLength(11);
    expect(within(audit).getAllByText('-').length).toBeGreaterThan(0);
    expect(
      within(audit).getByRole('columnheader', { name: 'Date/time' }),
    ).toBeInTheDocument();
    expect(
      standIn.state.requests.some(r => r.search.includes('pageSize=10')),
    ).toBe(true);
  });

  it('shows the empty text of a section that has nothing, never an empty area (BR1.2)', async () => {
    standIn.state.plan = [];
    standIn.state.ci = [];
    standIn.state.changes = [];
    standIn.state.audit = [];
    renderScreen(<GuardrailsView service={SERVICE} />);
    await waitFor(() =>
      expect(
        screen.getByText('No dependencies to upgrade.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('No failed CI runs.')).toBeInTheDocument();
    expect(screen.getByText('No open changes.')).toBeInTheDocument();
    expect(screen.getByText('No audit entries yet.')).toBeInTheDocument();
  });
});

describe('GuardrailsView propose (BR2.1, BR2.2, BR2.4)', () => {
  it('sends one proposal naming kind and target, then shows the banner and the new change', async () => {
    const { user } = await renderView();
    await user.click(
      screen.getByRole('button', { name: 'Propose change for lib-b' }),
    );
    const banner = await screen.findByTestId('result-banner');
    expect(banner).toHaveTextContent('Change proposed.');
    expect(banner).toHaveFocus();
    const posts = standIn.state.requests.filter(r => r.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ kind: 'upgrade', target: 'lib-b' });
    await waitFor(() =>
      expect(
        within(section('Open changes')).getByText(
          'Upgrade lib-b from 3.1 to 3.4',
        ),
      ).toBeInTheDocument(),
    );
    // The proposal is in the audit log with outcome Proposed (BR2.3).
    expect(standIn.state.audit[0]).toMatchObject({
      action: 'propose',
      outcome: 'proposed',
    });
  });

  it('proposes a re-run from a failed CI run', async () => {
    const { user } = await renderView();
    await user.click(
      screen.getByRole('button', { name: 'Propose re-run for build 39' }),
    );
    await screen.findByTestId('result-banner');
    expect(
      standIn.state.requests.filter(r => r.method === 'POST')[0].body,
    ).toEqual({
      kind: 'rerun',
      target: 'run-39',
    });
  });

  it('disables propose for the auditor with the reason and sends nothing', async () => {
    standIn.state.appUser = ALEX;
    const { user } = await renderView();
    const button = screen.getByRole('button', {
      name: 'Propose change for lib-a',
    });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(
      'Auditors can read but not change.',
    );
    await user.click(button);
    expect(
      standIn.state.requests.filter(r => r.method === 'POST'),
    ).toHaveLength(0);
  });

  it('shows the refusal in an announced alert and reloads when the proposal is no longer eligible', async () => {
    const { user } = await renderView();
    standIn.state.plan[0].currentVersion = '2.0';
    await user.click(
      screen.getByRole('button', { name: 'Propose change for lib-a' }),
    );
    const alert = await screen.findByTestId('refusal-alert');
    expect(alert).toHaveTextContent('This can no longer be proposed.');
    expect(alert).toHaveFocus();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Propose change for lib-a' }),
      ).toHaveAttribute('aria-disabled', 'true'),
    );
  });

  it('shows error.unreachable in an alert when a proposal meets a server that went down', async () => {
    const { user } = await renderView();
    standIn.state.serverDown = true;
    await user.click(
      screen.getByRole('button', { name: 'Propose change for lib-b' }),
    );
    const alert = await screen.findByTestId('refusal-alert');
    expect(alert).toHaveTextContent('Guardrails server unreachable.');
  });
});

describe('GuardrailsView propose when the target is gone', () => {
  it('says the change can no longer be proposed when the dependency no longer exists', async () => {
    const { user } = await renderView();
    standIn.state.plan = standIn.state.plan.filter(
      p => p.dependencyKey !== 'lib-b',
    );
    await user.click(
      screen.getByRole('button', { name: 'Propose change for lib-b' }),
    );
    const alert = await screen.findByTestId('refusal-alert');
    expect(alert).toHaveTextContent('This can no longer be proposed.');
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Propose change for lib-b' }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe('GuardrailsView when the guardrails server is down (BR6.1 to BR6.3)', () => {
  it('shows the server error panel in plan and CI, disables every write, and keeps open list and audit', async () => {
    standIn.state.serverDown = true;
    renderScreen(<GuardrailsView service={SERVICE} />);
    await waitFor(() =>
      expect(
        within(section('Dependency upgrade plan')).getByText(
          'Guardrails server unreachable.',
        ),
      ).toBeInTheDocument(),
    );
    expect(
      within(section('CI failure triage')).getByText(
        'Guardrails server unreachable.',
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(section('Open changes')).getByText(
          'Upgrade lib-a from 1.2 to 2.0',
        ),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        within(section('Audit log')).getByText('Page 1 of 3'),
      ).toBeInTheDocument(),
    );
    expect(
      within(section('Dependency upgrade plan')).getAllByRole('button', {
        name: 'Retry',
      }),
    ).toHaveLength(1);
  });

  it('enables the writes again after Retry succeeds', async () => {
    standIn.state.serverDown = true;
    const { user } = renderScreen(<GuardrailsView service={SERVICE} />);
    const plan = section('Dependency upgrade plan');
    await waitFor(() =>
      expect(
        within(plan).getByText('Guardrails server unreachable.'),
      ).toBeInTheDocument(),
    );
    const ci = section('CI failure triage');
    await waitFor(() =>
      expect(
        within(ci).getByText('Guardrails server unreachable.'),
      ).toBeInTheDocument(),
    );
    standIn.state.serverDown = false;
    // Writes stay disabled until every section that showed the error loads.
    await user.click(within(plan).getByRole('button', { name: 'Retry' }));
    const propose = await within(plan).findByRole('button', {
      name: 'Propose change for lib-a',
    });
    expect(propose).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(ci).getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(
        within(section('Dependency upgrade plan')).getByRole('button', {
          name: 'Propose change for lib-a',
        }),
      ).not.toHaveAttribute('aria-disabled'),
    );
  });

  it('disables writes in the other section while one shows the server error panel', async () => {
    standIn.state.modes.plan = 'server-down';
    renderScreen(<GuardrailsView service={SERVICE} />);
    await waitFor(() =>
      expect(
        within(section('Dependency upgrade plan')).getByText(
          'Guardrails server unreachable.',
        ),
      ).toBeInTheDocument(),
    );
    const rerun = await within(section('CI failure triage')).findByRole(
      'button',
      {
        name: 'Propose re-run for build 41',
      },
    );
    expect(rerun).toHaveAttribute('aria-disabled', 'true');
    expect(rerun).toHaveAccessibleDescription('Guardrails server unreachable.');
  });

  it('shows loadFailed with Retry for the open list alone when its read fails', async () => {
    standIn.state.modes.changes = 'error';
    const { user } = renderScreen(<GuardrailsView service={SERVICE} />);
    const open = section('Open changes');
    await waitFor(() =>
      expect(
        within(open).getByText('Could not load this section.'),
      ).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        within(section('Dependency upgrade plan')).getByRole('cell', {
          name: 'lib-a',
        }),
      ).toBeInTheDocument(),
    );
    standIn.state.modes.changes = 'ok';
    await user.click(within(open).getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(
        within(open).getByText('Upgrade lib-a from 1.2 to 2.0'),
      ).toBeInTheDocument(),
    );
  });

  it('shows loadFailed for the audit log when only the audit read fails', async () => {
    standIn.state.modes.audit = 'network';
    renderScreen(<GuardrailsView service={SERVICE} />);
    await waitFor(() =>
      expect(
        within(section('Audit log')).getByText('Could not load this section.'),
      ).toBeInTheDocument(),
    );
  });
});

describe('GuardrailsView audit filters and paging (BR4.2, BR4.3, BR4.4)', () => {
  const lastAuditQuery = () => {
    const reqs = standIn.state.requests.filter(r => r.path.endsWith('/audit'));
    return new URLSearchParams(reqs[reqs.length - 1].search);
  };

  it('applies an actor filter and returns to page 1', async () => {
    const { user } = await renderView();
    const audit = section('Audit log');
    await waitFor(() =>
      expect(within(audit).getByText('Page 1 of 3')).toBeInTheDocument(),
    );
    await user.click(within(audit).getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(within(audit).getByText('Page 2 of 3')).toBeInTheDocument(),
    );
    await user.selectOptions(within(audit).getByLabelText('Actor'), 'priya');
    await waitFor(() => expect(lastAuditQuery().get('actor')).toBe('priya'));
    expect(lastAuditQuery().get('page')).toBe('1');
  });

  it('applies action and outcome filters from the fixed lists', async () => {
    const { user } = await renderView();
    const audit = section('Audit log');
    await waitFor(() =>
      expect(within(audit).getByText('Page 1 of 3')).toBeInTheDocument(),
    );
    await user.selectOptions(within(audit).getByLabelText('Action'), 'approve');
    await user.selectOptions(
      within(audit).getByLabelText('Outcome'),
      'applied',
    );
    await waitFor(() =>
      expect(lastAuditQuery().get('outcome')).toBe('applied'),
    );
    expect(lastAuditQuery().get('action')).toBe('approve');
  });

  it('turns From and To dates into the start and end of the day in the viewer zone (D4)', async () => {
    const { user } = await renderView();
    const audit = section('Audit log');
    await waitFor(() =>
      expect(within(audit).getByText('Page 1 of 3')).toBeInTheDocument(),
    );
    fireEvent.change(within(audit).getByLabelText('From'), {
      target: { value: '2026-11-06' },
    });
    fireEvent.change(within(audit).getByLabelText('To'), {
      target: { value: '2026-11-06' },
    });
    await waitFor(() =>
      expect(lastAuditQuery().get('to')).toBe('2026-11-06T22:59:59.999Z'),
    );
    expect(lastAuditQuery().get('from')).toBe('2026-11-05T23:00:00.000Z');
    void user;
  });

  it('shows error.dateRange linked to the dates and requests nothing when To is before From', async () => {
    await renderView();
    const audit = section('Audit log');
    await waitFor(() =>
      expect(within(audit).getByText('Page 1 of 3')).toBeInTheDocument(),
    );
    const before = standIn.state.requests.length;
    fireEvent.change(within(audit).getByLabelText('From'), {
      target: { value: '2026-11-06' },
    });
    await waitFor(() => expect(lastAuditQuery().get('from')).not.toBeNull());
    const mid = standIn.state.requests.length;
    fireEvent.change(within(audit).getByLabelText('To'), {
      target: { value: '2026-11-01' },
    });
    expect(
      within(audit).getByText(
        'The end date must be on or after the start date.',
      ),
    ).toBeInTheDocument();
    expect(within(audit).getByLabelText('To')).toHaveAccessibleDescription(
      'The end date must be on or after the start date.',
    );
    await new Promise(r => setTimeout(r, 50));
    expect(standIn.state.requests.length).toBe(mid);
    expect(mid).toBeGreaterThan(before);
  });

  it('shows the filtered empty text, and Clear filters brings the entries back', async () => {
    const { user } = await renderView();
    const audit = section('Audit log');
    await waitFor(() =>
      expect(within(audit).getByText('Page 1 of 3')).toBeInTheDocument(),
    );
    await user.selectOptions(within(audit).getByLabelText('Outcome'), 'failed');
    await waitFor(() =>
      expect(
        within(audit).getByText('No entries match these filters.'),
      ).toBeInTheDocument(),
    );
    await user.click(
      within(audit).getByRole('button', { name: 'Clear filters' }),
    );
    await waitFor(() =>
      expect(within(audit).getByText('Page 1 of 3')).toBeInTheDocument(),
    );
    expect(within(audit).getByLabelText('Outcome')).toHaveValue('');
  });

  it('pages with Next and Previous and keeps focus on the controls', async () => {
    const { user } = await renderView();
    const audit = section('Audit log');
    await waitFor(() =>
      expect(within(audit).getByText('Page 1 of 3')).toBeInTheDocument(),
    );
    const next = within(audit).getByRole('button', { name: 'Next' });
    await user.click(next);
    await waitFor(() =>
      expect(within(audit).getByText('Page 2 of 3')).toBeInTheDocument(),
    );
    expect(lastAuditQuery().get('page')).toBe('2');
    expect(within(audit).getByRole('button', { name: 'Next' })).toHaveFocus();
  });

  it('offers no control that edits, deletes or adds an audit entry (BR4.3, NFR5.1)', async () => {
    await renderView();
    const audit = section('Audit log');
    await waitFor(() =>
      expect(within(audit).getByText('Page 1 of 3')).toBeInTheDocument(),
    );
    const names = [
      ...within(audit).queryAllByRole('button'),
      ...within(audit).queryAllByRole('link'),
      ...within(audit).queryAllByRole('combobox'),
      ...within(audit).queryAllByRole('textbox'),
    ].map(el => el.getAttribute('aria-label') ?? el.textContent ?? '');
    for (const name of names) {
      expect(name).not.toMatch(/edit|delete|remove|add|new|save/i);
    }
    const before = standIn.state.requests.filter(
      r => r.method !== 'GET',
    ).length;
    expect(before).toBe(0);
  });
});

describe('GuardrailsView demo-user switch (BR5.1 to BR5.4)', () => {
  it('shows the signed-in user and the switch button named for the user', async () => {
    await renderView();
    expect(screen.getByText('Signed in as: Sam')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Switch demo user, signed in as Sam',
      }),
    ).toBeInTheDocument();
  });

  it('switches by keyboard, reloads everything with the new credential, clears the banner and returns focus', async () => {
    const { user } = await renderView();
    await user.click(
      screen.getByRole('button', { name: 'Propose change for lib-b' }),
    );
    await screen.findByTestId('result-banner');
    const button = screen.getByRole('button', {
      name: 'Switch demo user, signed in as Sam',
    });
    button.focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(i => i.textContent),
    ).toEqual([
      'Sam, Service owner',
      'Priya, Platform engineer',
      'Alex, Auditor',
    ]);
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Switch demo user, signed in as Priya',
        }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('result-banner')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Switch demo user, signed in as Priya',
      }),
    ).toHaveFocus();
    expect(screen.getByText('Signed in as Priya.')).toBeInTheDocument();
    await waitFor(() => {
      const reads = standIn.state.requests.filter(
        r => r.method === 'GET' && /\/plan$/.test(r.path),
      );
      expect(reads[reads.length - 1].headers.authorization).toBe(
        'Bearer token-priya',
      );
    });
    await waitFor(() =>
      expect(screen.getByText('Signed in as: Priya')).toBeInTheDocument(),
    );
  });

  it('closes the menu with Escape and returns focus to the button', async () => {
    const { user } = await renderView();
    const button = screen.getByRole('button', {
      name: 'Switch demo user, signed in as Sam',
    });
    await user.click(button);
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
    expect(button).toHaveFocus();
  });

  it('re-evaluates the actions for the auditor after a switch', async () => {
    const { user } = await renderView();
    await user.click(
      screen.getByRole('button', {
        name: 'Switch demo user, signed in as Sam',
      }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /Alex/ }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Propose change for lib-a' }),
      ).toHaveAttribute('aria-disabled', 'true'),
    );
  });

  it('keeps the user and announces error.generic when the start address fails', async () => {
    const { user } = await renderView();
    standIn.state.startStatus = 500;
    await user.click(
      screen.getByRole('button', {
        name: 'Switch demo user, signed in as Sam',
      }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /Priya/ }));
    await waitFor(() =>
      expect(
        screen.getByText('Something went wrong. Try again.'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', {
        name: 'Switch demo user, signed in as Sam',
      }),
    ).toBeInTheDocument();
  });

  it('shows only the name and no switch when the demo sign-in is off, and calls no start address', async () => {
    standIn.state.demoEnabled = false;
    await renderView();
    expect(
      screen.queryByRole('button', { name: /Switch demo user/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Signed in as: Sam')).toBeInTheDocument();
    expect(
      standIn.state.requests.some(r => r.path.endsWith('/demo/start')),
    ).toBe(false);
  });
});
