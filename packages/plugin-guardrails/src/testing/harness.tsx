import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { createGuardrailsClient, type GuardrailsClient } from '../api/client';
import type { SessionStorageLike } from '../api/demoSession';
import { GuardrailsProvider } from '../context';
import {
  BACKEND,
  createHandlers,
  makeState,
  type StandInState,
} from './standIn/handlers';

export interface StandIn {
  state: StandInState;
}

/**
 * Registers the stand-in backend for a test file: one msw server, a fresh
 * state before every test. Call once at the top of the file.
 */
export function setupStandIn(): StandIn {
  const holder: StandIn = { state: makeState() };
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  beforeEach(() => {
    holder.state = makeState();
    server.resetHandlers(...createHandlers(holder.state));
  });
  afterAll(() => server.close());
  return holder;
}

export function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  const storage: SessionStorageLike & { data: Record<string, string> } = {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: k => {
      delete data[k];
    },
  };
  return storage;
}

/** Shows where navigation ended and the state it carried (the banner key). */
function LocationProbe() {
  const location = useLocation();
  const banner = (location.state as { banner?: string } | null)?.banner ?? '';
  return (
    <div
      data-testid="elsewhere"
      data-path={location.pathname}
      data-banner={banner}
    />
  );
}

export interface RenderOptions {
  /** Where the memory router starts. */
  route?: string;
  /** Route pattern when the element needs params. */
  path?: string;
  storage?: SessionStorageLike;
  fetchImpl?: typeof fetch;
  /** True when the test uses jest fake timers. */
  fakeTimers?: boolean;
}

/**
 * Renders a screen against the stand-in backend with the real GuardrailsApi
 * and DemoSession (the two seams of the design are the only things tests
 * replace, and here they are real on a stand-in network).
 */
export function renderScreen(
  ui: ReactElement,
  options: RenderOptions = {},
): RenderResult & {
  user: ReturnType<typeof userEvent.setup>;
  client: GuardrailsClient;
} {
  const client = createGuardrailsClient({
    discoveryApi: {
      getBaseUrl: async id =>
        id === 'guardrails' ? BACKEND : 'http://backend.test/api/auth',
    },
    fetchApi: { fetch: options.fetchImpl ?? ((i, init) => fetch(i, init)) },
    storage: options.storage ?? memoryStorage(),
  });
  const user = options.fakeTimers
    ? userEvent.setup({ advanceTimers: ms => jest.advanceTimersByTime(ms) })
    : userEvent.setup();
  const route = options.route ?? '/';
  const tree = (
    <MemoryRouter initialEntries={[route]}>
      <GuardrailsProvider client={client}>
        {options.path ? (
          <Routes>
            <Route path={options.path} element={ui} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        ) : (
          ui
        )}
      </GuardrailsProvider>
    </MemoryRouter>
  );
  const result = render(tree);
  return { ...result, user, client };
}
