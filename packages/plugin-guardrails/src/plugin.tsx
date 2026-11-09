import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
// The entity-page blueprints are in the `alpha` entry point of the pinned
// catalog-react version (confirmed in Code Generation step 1; see code-summary).
import {
  EntityCardBlueprint,
  EntityContentBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import { createGuardrailsClient, guardrailsClientApiRef } from './api/client';
import { rootRouteRef } from './routes';

export { rootRouteRef };

/** Builds the plugin's API and session from Backstage's discovery and fetch APIs. */
export const clientFactory = ({
  discoveryApi,
  fetchApi,
}: {
  discoveryApi: { getBaseUrl(pluginId: string): Promise<string> };
  fetchApi: { fetch: typeof fetch };
}) => createGuardrailsClient({ discoveryApi, fetchApi });

// The screens load when their route is first opened, not at app start
// (performance design P8, NFR1.7).
export const loadTab = async () => {
  const { GuardrailsTab } = await import('./screens/GuardrailsTab');
  return <GuardrailsTab />;
};

export const loadCard = async () => {
  const { OverviewCardEntity } = await import('./screens/OverviewCardEntity');
  return <OverviewCardEntity />;
};

const guardrailsApi = ApiBlueprint.make({
  name: 'client',
  params: define =>
    define({
      api: guardrailsClientApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: clientFactory,
    }),
});

const guardrailsTab = EntityContentBlueprint.make({
  params: {
    path: 'guardrails',
    title: 'Guardrails',
    routeRef: rootRouteRef,
    loader: loadTab,
  },
});

const guardrailsCard = EntityCardBlueprint.make({
  params: {
    type: 'info',
    loader: loadCard,
  },
});

/**
 * The guardrails frontend plugin (contract C3: plugin id `guardrails`).
 * u4 loads it in the host app with the new frontend system.
 */
export const guardrailsPlugin = createFrontendPlugin({
  pluginId: 'guardrails',
  routes: { root: rootRouteRef },
  extensions: [guardrailsApi, guardrailsTab, guardrailsCard],
});
