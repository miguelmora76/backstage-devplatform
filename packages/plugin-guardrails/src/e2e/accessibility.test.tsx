import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { GuardrailsOverviewCard } from '../components/GuardrailsOverviewCard';
import { GuardrailsView } from '../screens/GuardrailsView';
import { renderScreen, setupStandIn } from '../testing/harness';
import {
  ALEX,
  PRIYA,
  SERVICE,
  type StandInState,
} from '../testing/standIn/handlers';

// NFR3.1: one test per variant of the scan list runs the checker and finds no
// violation. The detail screen's variants are in ChangeDetailScreen.test.tsx.
const standIn = setupStandIn();

interface Variant {
  name: string;
  prepare?: (s: StandInState) => void;
  /** Waits until the variant has settled. */
  settle: () => Promise<unknown> | unknown;
  act?: (view: ReturnType<typeof renderScreen>) => Promise<unknown>;
}

const sectionNamed = (name: string) => screen.getByRole('region', { name });

describe('card variants (Screen A)', () => {
  const card = () => (
    <GuardrailsOverviewCard service={SERVICE} to="/guardrails" />
  );
  const variants: Variant[] = [
    {
      name: 'loaded',
      settle: () =>
        screen
          .findByText('Upgrades available')
          .then(() =>
            waitFor(() =>
              expect(screen.getByTestId('count-open')).toHaveTextContent('2'),
            ),
          ),
    },
    {
      name: 'loading',
      prepare: s => {
        s.delayMs = 40;
      },
      settle: () => screen.getByRole('status'),
    },
    {
      name: 'empty',
      prepare: s => {
        s.plan = [];
        s.ci = [];
        s.changes = [];
      },
      settle: () => screen.findByText('Nothing to review.'),
    },
    {
      name: 'error',
      prepare: s => {
        s.serverDown = true;
      },
      settle: () => screen.findByText('Guardrails server unreachable.'),
    },
  ];
  it.each(variants)('card $name has no violations', async v => {
    v.prepare?.(standIn.state);
    const { container } = renderScreen(card());
    await v.settle();
    expect(await axe(container)).toHaveNoViolations();
    await waitFor(() => undefined);
  });
});

describe('Guardrails view variants (Screen B)', () => {
  const view = () => <GuardrailsView service={SERVICE} />;
  const variants: Variant[] = [
    {
      name: 'each section loading',
      prepare: s => {
        s.delayMs = 50;
      },
      settle: () => screen.getAllByRole('status'),
    },
    {
      name: 'plan and CI error',
      prepare: s => {
        s.serverDown = true;
      },
      settle: () => screen.findAllByText('Guardrails server unreachable.'),
    },
    {
      name: 'open list and audit load failure',
      prepare: s => {
        s.modes.changes = 'error';
        s.modes.audit = 'error';
      },
      settle: () =>
        waitFor(() =>
          expect(
            screen.getAllByText('Could not load this section.'),
          ).toHaveLength(2),
        ),
    },
    {
      name: 'every section empty',
      prepare: s => {
        s.plan = [];
        s.ci = [];
        s.changes = [];
        s.audit = [];
      },
      settle: () => screen.findByText('No audit entries yet.'),
    },
    {
      name: 'as the auditor',
      prepare: s => {
        s.appUser = ALEX;
      },
      settle: () => screen.findByText('Signed in as: Alex'),
    },
    {
      name: 'as another user with a pending change',
      prepare: s => {
        s.appUser = PRIYA;
      },
      settle: () => screen.findByText('Signed in as: Priya'),
    },
    {
      name: 'banner shown',
      settle: async () => {
        await screen.findByText('Upgrade lib-a from 1.2 to 2.0');
      },
      act: async ({ user }) => {
        await user.click(
          await screen.findByRole('button', {
            name: 'Propose change for lib-b',
          }),
        );
        await screen.findByTestId('result-banner');
      },
    },
    {
      name: 'refusal alert shown',
      settle: () => screen.findByText('Upgrade lib-a from 1.2 to 2.0'),
      act: async ({ user }) => {
        standIn.state.plan[0].currentVersion = '2.0';
        await user.click(
          await screen.findByRole('button', {
            name: 'Propose change for lib-a',
          }),
        );
        await screen.findByTestId('refusal-alert');
      },
    },
    {
      name: 'filters with no match',
      settle: () => screen.findByText('Page 1 of 3'),
      act: async ({ user }) => {
        await user.selectOptions(screen.getByLabelText('Outcome'), 'failed');
        await screen.findByText('No entries match these filters.');
      },
    },
    {
      name: 'bad date range',
      settle: () => screen.findByText('Page 1 of 3'),
      act: async () => {
        fireEvent.change(screen.getByLabelText('From'), {
          target: { value: '2026-11-06' },
        });
        fireEvent.change(screen.getByLabelText('To'), {
          target: { value: '2026-11-01' },
        });
        await screen.findByText(
          'The end date must be on or after the start date.',
        );
      },
    },
    {
      name: 'second page of the audit log',
      settle: () => screen.findByText('Page 1 of 3'),
      act: async ({ user }) => {
        await user.click(
          within(sectionNamed('Audit log')).getByRole('button', {
            name: 'Next',
          }),
        );
        await screen.findByText('Page 2 of 3');
      },
    },
    {
      name: 'switch menu open',
      settle: () => screen.findByText('Signed in as: Sam'),
      act: async ({ user }) => {
        await user.click(
          screen.getByRole('button', { name: /Switch demo user/ }),
        );
        await screen.findByRole('menu');
      },
    },
  ];
  it.each(variants)('$name has no violations', async v => {
    v.prepare?.(standIn.state);
    const rendered = renderScreen(view());
    await v.settle();
    if (v.act) await v.act(rendered);
    // The open menu is a pop-up rendered outside the page landmarks by design;
    // the "all content in landmarks" best-practice rule does not apply to it.
    const options =
      v.name === 'switch menu open'
        ? { rules: { region: { enabled: false } } }
        : undefined;
    expect(await axe(document.body, options)).toHaveNoViolations();
    // Let pending loads finish so nothing updates after the test.
    await waitFor(() => undefined);
  });
});
