import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef } from '@backstage/frontend-plugin-api';
import { guardrailsPlugin } from 'plugin-guardrails';
import { appFeatures } from './features';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HomeRedirect, SignInPageWithApis, signInModule } from './signInModule';

const discovery = {
  getBaseUrl: async (pluginId: string) => `http://backend.test/api/${pluginId}`,
};

function reply(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const usersBody = {
  items: [{ userId: 'sam', name: 'Sam', role: 'service-owner' }],
};
const startBody = {
  profile: { displayName: 'Sam' },
  providerInfo: {},
  backstageIdentity: {
    token: 'fake-token-sam',
    identity: {
      type: 'user',
      userEntityRef: 'user:default/sam',
      ownershipEntityRefs: ['user:default/sam'],
    },
  },
};

describe('app wiring', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads the catalog pages, the sign-in page and the guardrails plugin, and nothing else (BR1.1)', () => {
    expect(appFeatures).toHaveLength(3);
    expect(appFeatures).toContain(guardrailsPlugin);
    expect(appFeatures).toContain(signInModule);
    const ids = appFeatures.map(
      feature => (feature as { pluginId?: string }).pluginId,
    );
    expect(ids).toContain('catalog');
    expect(ids).toContain('guardrails');
  });

  it('puts the sign-in page into the app plugin (BR2.2)', () => {
    expect(signInModule.pluginId).toBe('app');
  });

  it('sends the app root to the catalog, so a signed-in person lands on a page (W2)', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/catalog" element={<div>catalog page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('catalog page')).toBeInTheDocument();
  });

  it('reads the user list and starts the sign-in at addresses from the discovery service, then signs out by forgetting the identity (BR2.3, BR2.5, NFR5.4)', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      const text = String(url);
      calls.push(text);
      return text.includes('demo-users') ? reply(usersBody) : reply(startBody);
    }) as unknown as typeof fetch;

    const onSignInSuccess = jest.fn();
    render(
      <TestApiProvider apis={[[discoveryApiRef, discovery]]}>
        <SignInPageWithApis onSignInSuccess={onSignInSuccess} />
      </TestApiProvider>,
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sign in as Sam' }),
    );
    await waitFor(() => expect(onSignInSuccess).toHaveBeenCalledTimes(1));
    expect(calls).toEqual([
      'http://backend.test/api/guardrails/demo-users',
      'http://backend.test/api/auth/demo/start?userId=sam',
    ]);

    const identity = onSignInSuccess.mock.calls[0][0];
    await expect(identity.getCredentials()).resolves.toEqual({
      token: 'fake-token-sam',
    });
    await identity.signOut();
    await expect(identity.getCredentials()).resolves.toEqual({});
  });
});
