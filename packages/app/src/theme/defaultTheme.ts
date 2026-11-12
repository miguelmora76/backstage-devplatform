import appPlugin from '@backstage/plugin-app';
import {
  ApiBlueprint,
  type AnyApiFactory,
  type AppThemeApi,
} from '@backstage/frontend-plugin-api';

/** The theme a first-time visitor sees (FR2.1). It is one of Backstage's own two. */
export const DEFAULT_THEME_ID = 'dark';

/**
 * Makes dark the starting theme when the visitor has not chosen one. A choice
 * made earlier (Backstage keeps it itself) is left as it is, and Backstage's
 * light and dark switch keeps working. This code reads and writes no browser
 * storage: it only sets the active theme on Backstage's theme API.
 */
export function withDarkDefault<T extends AppThemeApi>(api: T): T {
  if (api.getActiveThemeId() === undefined) {
    api.setActiveThemeId(DEFAULT_THEME_ID);
  }
  return api;
}

/**
 * Backstage's own theme API with the dark default applied. It replaces the app
 * plugin's `app-theme` extension from inside an existing module, so the app
 * still loads exactly three features (FR4.3).
 */
export const darkDefaultThemeApi = appPlugin
  .getExtension('api:app/app-theme')
  .override({
    factory(originalFactory) {
      const original = originalFactory().get(ApiBlueprint.dataRefs.factory);
      const withDefault: AnyApiFactory = {
        ...original,
        factory: deps => withDarkDefault(original.factory(deps) as AppThemeApi),
      };
      return [ApiBlueprint.dataRefs.factory(withDefault)];
    },
  });
