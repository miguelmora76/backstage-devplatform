import { screen, waitFor, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestApiProvider } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { routeResolutionApiRef } from '@backstage/frontend-plugin-api';
import { guardrailsClientApiRef, createGuardrailsClient } from '../api/client';
import { memoryStorage, setupStandIn } from '../testing/harness';
import { BACKEND, SERVICE } from '../testing/standIn/handlers';
import { GuardrailsTab } from './GuardrailsTab';
import { OverviewCardEntity } from './OverviewCardEntity';

setupStandIn();

const entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: SERVICE, namespace: 'default' },
};

function wrap(ui: JSX.Element, tabLink?: string) {
  const client = createGuardrailsClient({
    discoveryApi: {
      getBaseUrl: async id =>
        id === 'guardrails' ? BACKEND : 'http://backend.test/api/auth',
    },
    fetchApi: { fetch: (i, init) => fetch(i, init) },
    storage: memoryStorage(),
  });
  return render(
    <TestApiProvider
      apis={[
        [guardrailsClientApiRef, client],
        [
          routeResolutionApiRef,
          { resolve: () => (tabLink ? () => tabLink : undefined) } as never,
        ],
      ]}
    >
      <EntityProvider entity={entity}>
        <MemoryRouter>{ui}</MemoryRouter>
      </EntityProvider>
    </TestApiProvider>,
  );
}

describe('entity page wrappers (D1)', () => {
  it('the tab uses the catalog entity name as the service of every call', async () => {
    wrap(<GuardrailsTab />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        SERVICE,
      ),
    );
    await screen.findByText('Upgrade lib-a from 1.2 to 2.0');
  });

  it('the overview card uses the entity name and links to the tab route', async () => {
    wrap(
      <OverviewCardEntity />,
      '/catalog/default/component/payments-api/guardrails',
    );
    await waitFor(() =>
      expect(screen.getByTestId('count-open')).toHaveTextContent('2'),
    );
    expect(
      screen.getByRole('link', { name: 'Open Guardrails' }),
    ).toHaveAttribute(
      'href',
      '/catalog/default/component/payments-api/guardrails',
    );
  });

  it('the overview card falls back to the relative tab path when the route cannot be resolved', async () => {
    wrap(<OverviewCardEntity />);
    await waitFor(() =>
      expect(screen.getByTestId('count-open')).toHaveTextContent('2'),
    );
    expect(
      screen.getByRole('link', { name: 'Open Guardrails' }),
    ).toHaveAttribute('href', '/guardrails');
  });
});
