import { Profiler } from 'react';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { OpenChangesSection } from '../components/OpenChangesSection';
import { GuardrailsOverviewCard } from '../components/GuardrailsOverviewCard';
import { GuardrailsView } from '../screens/GuardrailsView';
import { ChangeDetailScreen } from '../screens/ChangeDetailScreen';
import { renderScreen, setupStandIn } from '../testing/harness';
import { PRIYA, SAM, SERVICE } from '../testing/standIn/handlers';
import { t } from '../texts/texts';
import type { Change } from '../api/types';

const standIn = setupStandIn();

// Timing tests use fake timers; no test waits in real time (NFR7.1).
describe('performance (NFR1.2 to NFR1.6)', () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: false }));
  afterEach(() => jest.useRealTimers());

  const advance = (ms: number) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });

  it('NFR1.2: four sections with 300 ms answers are all loaded within 700 ms', async () => {
    standIn.state.delayMs = 300;
    renderScreen(<GuardrailsView service={SERVICE} />, { fakeTimers: true });
    await advance(700);
    const regions = [
      'Dependency upgrade plan',
      'CI failure triage',
      'Open changes',
      'Audit log',
    ];
    for (const name of regions) {
      expect(
        within(screen.getByRole('region', { name })).queryByText(/^Loading /),
      ).toBeNull();
    }
    expect(
      screen.getByText('Upgrade lib-a from 1.2 to 2.0'),
    ).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('region', { name: 'Dependency upgrade plan' }),
      ).getByRole('cell', { name: 'lib-a' }),
    ).toBeInTheDocument();
  });

  it('NFR1.3: the card makes three reads of 300 ms and finishes within 700 ms', async () => {
    standIn.state.delayMs = 300;
    renderScreen(<GuardrailsOverviewCard service={SERVICE} to="/g" />, {
      fakeTimers: true,
    });
    await advance(700);
    expect(screen.getByTestId('count-open')).toHaveTextContent('2');
  });

  it('NFR1.4: a section whose read never gets an answer shows loadFailed at 5 seconds', async () => {
    standIn.state.modes.audit = 'never';
    renderScreen(<GuardrailsView service={SERVICE} />, { fakeTimers: true });
    await advance(4900);
    const audit = screen.getByRole('region', { name: 'Audit log' });
    expect(within(audit).queryByText(t('error.loadFailed'))).toBeNull();
    await advance(200);
    expect(within(audit).getByText(t('error.loadFailed'))).toBeInTheDocument();
  });

  it('NFR1.4: a write that gets no answer shows submitFailed at 12 seconds, with the reason kept', async () => {
    standIn.state.appUser = PRIYA;
    const { user } = renderScreen(
      <ChangeDetailScreen service={SERVICE} changeId="c1" />,
      {
        route: '/changes/c1',
        path: '/changes/:changeId',
        fakeTimers: true,
      },
    );
    await advance(50);
    fireEvent.change(screen.getByLabelText(t('label.reason')), {
      target: { value: 'Keep me' },
    });
    standIn.state.modes.write = 'never';
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await advance(11900);
    expect(screen.queryByTestId('refusal-alert')).toBeNull();
    await advance(200);
    expect(screen.getByTestId('refusal-alert')).toHaveTextContent(
      t('error.submitFailed'),
    );
    expect(
      (screen.getByLabelText(t('label.reason')) as HTMLTextAreaElement).value,
    ).toBe('Keep me');
    void user;
  });

  it('NFR1.4: a 503 SERVER_UNREACHABLE after 3 seconds shows the server error panel, not loadFailed', async () => {
    standIn.state.serverDown = true;
    standIn.state.delayMs = 3000;
    renderScreen(<GuardrailsView service={SERVICE} />, { fakeTimers: true });
    await advance(3100);
    const plan = screen.getByRole('region', {
      name: 'Dependency upgrade plan',
    });
    expect(within(plan).getByText(t('error.unreachable'))).toBeInTheDocument();
    expect(within(plan).queryByText(t('error.loadFailed'))).toBeNull();
  });

  it('NFR1.5: Working... shows in the same render as the press, before any answer', async () => {
    standIn.state.delayMs = 1000;
    renderScreen(<GuardrailsView service={SERVICE} />, { fakeTimers: true });
    await advance(1100);
    fireEvent.click(
      screen.getByRole('button', { name: 'Propose change for lib-b' }),
    );
    expect(
      screen.getByRole('button', { name: 'Propose change for lib-b' }),
    ).toHaveTextContent(t('status.working'));
  });
});

describe('render guard with the seeded set (NFR1.6)', () => {
  it('renders 200 open changes with no single commit taking 1 second', async () => {
    const many: Change[] = Array.from({ length: 200 }, (_, i) => ({
      changeId: `c${i + 10}`,
      kind: 'upgrade',
      service: SERVICE,
      target: `lib-${i}`,
      summary: `Upgrade lib-${i} from 1.0 to 2.0`,
      proposedBy: SAM,
      status: i % 3 === 0 ? 'failed' : 'pending',
      proposedAt: `2026-11-06T${String(8 + (i % 10)).padStart(2, '0')}:00:00.000Z`,
      allowedActions: [],
    }));
    standIn.state.changes = many;
    // React's own measure of the time each commit spent rendering, so the
    // guard does not depend on how long the network round trip took.
    const durations: number[] = [];
    renderScreen(
      <Profiler
        id="open"
        onRender={(_id, _phase, actual) => durations.push(actual)}
      >
        <OpenChangesSection service={SERVICE} version={0} />
      </Profiler>,
    );
    await waitFor(
      () =>
        expect(
          screen.getAllByRole('link', { name: /View change/ }),
        ).toHaveLength(200),
      { timeout: 10000 },
    );
    expect(Math.max(...durations)).toBeLessThan(1000);
  });
});
