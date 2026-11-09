import type { BackendFeature } from '@backstage/backend-plugin-api';
import appBackend from '@backstage/plugin-app-backend';
import authBackend from '@backstage/plugin-auth-backend';
import catalogBackend from '@backstage/plugin-catalog-backend';
import guardrailsBackend, {
  authModuleDemoSignIn,
} from 'plugin-guardrails-backend';

/**
 * The one list of backend features (BR1.1, reliability design R7): the entry
 * point and the start-up test both build from it, so a feature missing from
 * the entry point is missing from the test. The app loads exactly these and
 * nothing else: the app backend (serves the built frontend), the catalog, the
 * auth backend, the guardrails plugin and its demo sign-in module. The module
 * registers the `demo` provider only while the demo switch is on (BR2.1).
 */
export const backendFeatures: BackendFeature[] = [
  appBackend,
  catalogBackend,
  authBackend,
  guardrailsBackend,
  authModuleDemoSignIn,
];
