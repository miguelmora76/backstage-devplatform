import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { guardrailsPlugin } from 'plugin-guardrails';
import { signInModule } from './signInModule';

/**
 * The one list of frontend features (BR1.1): the catalog pages, the demo
 * sign-in page and the guardrails plugin, and nothing else (D1). The app plugin
 * itself is added by `createApp`.
 */
export const appFeatures = [catalogPlugin, signInModule, guardrailsPlugin];
