import { createApiRef } from '@backstage/frontend-plugin-api';
import { DemoSession, type SessionStorageLike } from './demoSession';
import { GuardrailsApi } from './guardrailsApi';

/** The two replaceable seams of the plugin, built together (NFR2.4). */
export interface GuardrailsClient {
  api: GuardrailsApi;
  session: DemoSession;
}

export const guardrailsClientApiRef = createApiRef<GuardrailsClient>({
  id: 'plugin.guardrails.client',
});

interface Deps {
  discoveryApi: { getBaseUrl(pluginId: string): Promise<string> };
  fetchApi: { fetch: typeof fetch };
  /** Tab storage for the chosen userId; tests pass their own. */
  storage?: SessionStorageLike;
}

/**
 * Builds the API and the session from Backstage's discovery and fetch APIs.
 * No address, port or secret is written in the plugin (NFR5.11).
 */
export function createGuardrailsClient({
  discoveryApi,
  fetchApi,
  storage,
}: Deps): GuardrailsClient {
  const session = new DemoSession({ discoveryApi, fetchApi, storage });
  const api = new GuardrailsApi({
    discoveryApi,
    fetchApi,
    credential: session,
  });
  session.setUsersLoader(() => api.demoUsers());
  return { api, session };
}
