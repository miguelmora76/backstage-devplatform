import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { GuardrailsOverviewCard } from './GuardrailsOverviewCard';
import { renderScreen, setupStandIn } from '../testing/harness';
import { SERVICE } from '../testing/standIn/handlers';

const standIn = setupStandIn();

const card = () => (
  <GuardrailsOverviewCard service={SERVICE} to="/guardrails" />
);

describe('GuardrailsOverviewCard (BR1.4, BR1.2; Screen A)', () => {
  it('shows the three counts and a link to the Guardrails view', async () => {
    renderScreen(card());
    await waitFor(() =>
      expect(screen.getByTestId('count-upgrades')).toHaveTextContent('2'),
    );
    expect(screen.getByTestId('count-failedRuns')).toHaveTextContent('2');
    expect(screen.getByTestId('count-open')).toHaveTextContent('2');
    expect(
      screen.getByRole('link', { name: 'Open Guardrails' }),
    ).toHaveAttribute('href', '/guardrails');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Guardrails' }),
    ).toBeInTheDocument();
  });

  it('shows the labels', async () => {
    renderScreen(card());
    await waitFor(() =>
      expect(screen.getByTestId('count-open')).toHaveTextContent('2'),
    );
    expect(screen.getByText('Upgrades available')).toBeInTheDocument();
    expect(screen.getByText('Failed CI runs')).toBeInTheDocument();
    expect(screen.getByText('Open changes')).toBeInTheDocument();
  });

  it('is busy with "Loading..." in place of counts and a polite status while loading', async () => {
    standIn.state.delayMs = 50;
    const { container } = renderScreen(card());
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.getAllByText('Loading...').length).toBe(3);
    expect(screen.getByRole('status')).toHaveTextContent('Loading Guardrails.');
    await waitFor(() =>
      expect(screen.getByTestId('count-open')).toHaveTextContent('2'),
    );
  });

  it('says "Nothing to review." with zeros when all three counts are zero', async () => {
    standIn.state.plan = [];
    standIn.state.ci = [];
    standIn.state.changes = [];
    renderScreen(card());
    await waitFor(() =>
      expect(screen.getByText('Nothing to review.')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('count-upgrades')).toHaveTextContent('0');
  });

  it('shows the server error with Retry when the server is down, and loads on Retry', async () => {
    standIn.state.serverDown = true;
    const { user } = renderScreen(card());
    await waitFor(() =>
      expect(
        screen.getByText('Guardrails server unreachable.'),
      ).toBeInTheDocument(),
    );
    standIn.state.serverDown = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(screen.getByTestId('count-upgrades')).toHaveTextContent('2'),
    );
  });

  it('shows loadFailed with Retry when the open list read fails', async () => {
    standIn.state.modes.changes = 'error';
    renderScreen(card());
    await waitFor(() =>
      expect(
        screen.getByText('Could not load this section.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows a dash, not "Loading...", in place of the counts when a read failed', async () => {
    standIn.state.modes.changes = 'error';
    renderScreen(card());
    await waitFor(() =>
      expect(
        screen.getByText('Could not load this section.'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByTestId('count-open')).toHaveTextContent('-');
  });

  it('makes its three reads at the same time', async () => {
    renderScreen(card());
    await waitFor(() => {
      const paths = standIn.state.requests.map(r => r.path);
      expect(
        paths.filter(p => /\/(plan|ci-runs|changes)$/.test(p)),
      ).toHaveLength(3);
    });
  });

  it('has no accessibility violations loaded, empty or in error', async () => {
    const { container } = renderScreen(card());
    await waitFor(() =>
      expect(screen.getByTestId('count-open')).toHaveTextContent('2'),
    );
    expect(await axe(container)).toHaveNoViolations();
    void within;
  });
});
