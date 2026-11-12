import catalogPlugin from '@backstage/plugin-catalog/alpha';
import userSettingsPlugin from '@backstage/plugin-user-settings/alpha';
import { guardrailsPlugin } from 'plugin-guardrails';
import { signInModule } from './signInModule';

/**
 * The one list of frontend features (BR1.1, revised): the catalog pages, the
 * demo sign-in page, the guardrails plugin and Backstage's user settings page
 * (the visible light/dark switch), and nothing else (D1). The app plugin
 * itself is added by `createApp`.
 */
export const appFeatures = [
  catalogPlugin,
  signInModule,
  guardrailsPlugin,
  userSettingsPlugin,
];
