import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import { createGuardrailsClient } from './api/client';
import { GuardrailsProvider } from './context';
import { GuardrailsRoutes } from './screens/GuardrailsRoutes';
import { memoryStorage, setupStandIn } from './testing/harness';
import { BACKEND, SERVICE } from './testing/standIn/handlers';

setupStandIn();

function renderRoutes(initial: string) {
  const client = createGuardrailsClient({
    discoveryApi: {
      getBaseUrl: async id =>
        id === 'guardrails' ? BACKEND : 'http://backend.test/api/auth',
    },
    fetchApi: { fetch: (i, init) => fetch(i, init) },
    storage: memoryStorage(),
  });
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <GuardrailsProvider client={client}>
        <Routes>
          <Route
            path="/catalog/default/component/payments-api/guardrails/*"
            element={<GuardrailsRoutes service={SERVICE} />}
          />
        </Routes>
      </GuardrailsProvider>
    </MemoryRouter>,
  );
}

describe('Guardrails tab routes (NFR2.7, D1)', () => {
  it('shows the Guardrails view at the tab path', async () => {
    renderRoutes('/catalog/default/component/payments-api/guardrails');
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        SERVICE,
      ),
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Audit log' }),
    ).toBeInTheDocument();
  });

  it('shows the change detail at changes/:changeId', async () => {
    renderRoutes(
      '/catalog/default/component/payments-api/guardrails/changes/c1',
    );
    await waitFor(() =>
      expect(screen.getByTestId('detail-h1')).toHaveTextContent(
        'Upgrade lib-a from 1.2 to 2.0',
      ),
    );
  });

  it('shows not found for an unknown change id', async () => {
    renderRoutes(
      '/catalog/default/component/payments-api/guardrails/changes/zz',
    );
    await waitFor(() =>
      expect(
        screen.getByText('This change no longer exists.'),
      ).toBeInTheDocument(),
    );
  });

  it('opens the detail from the View link of the open list and comes back with Back', async () => {
    renderRoutes('/catalog/default/component/payments-api/guardrails');
    const link = await screen.findByRole('link', {
      name: 'View change: Upgrade lib-a from 1.2 to 2.0',
    });
    expect(link).toHaveAttribute(
      'href',
      '/catalog/default/component/payments-api/guardrails/changes/c1',
    );
    link.click();
    await waitFor(() =>
      expect(screen.getByTestId('detail-h1')).toHaveTextContent(
        'Upgrade lib-a',
      ),
    );
    // Back leads to the tab path (the view), not above it.
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/catalog/default/component/payments-api/guardrails',
    );
  });
});
