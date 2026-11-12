import appPlugin from '@backstage/plugin-app';
import { prepareSpecializedApp } from '@backstage/frontend-app-api';
import {
  appThemeApiRef,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import type { AppThemeApi } from '@backstage/frontend-plugin-api';
import { appFeatures } from '../features';
import { signInModule } from '../signInModule';
import {
  DEFAULT_THEME_ID,
  darkDefaultThemeApi,
  withDarkDefault,
} from './defaultTheme';

// FR2.1 and FR2.2: a first-time visitor sees the dark theme, and Backstage's
// own light and dark choice stays available. The tests build the real app
// plugin with a module that carries the default and read the theme API the
// running app would use. (The sign-in module itself needs a sign-in round
// trip before a specialized app can be finalized, so a separate test checks
// that it carries the same extension.)
const themeModule = createFrontendModule({
  pluginId: 'app',
  extensions: [darkDefaultThemeApi],
});

function themeApi(): AppThemeApi {
  const { apis } = prepareSpecializedApp({
    features: [appPlugin, themeModule],
  }).getBootstrapApp();
  const api = apis.get(appThemeApiRef);
  if (!api) {
    throw new Error('The app has no theme API');
  }
  return api;
}

function fakeThemeApi(initial?: string) {
  let active = initial;
  const calls: Array<string | undefined> = [];
  const api: AppThemeApi = {
    getInstalledThemes: () => [],
    activeThemeId$: () => {
      throw new Error('not used');
    },
    getActiveThemeId: () => active,
    setActiveThemeId: id => {
      calls.push(id);
      active = id;
    },
  };
  return { api, calls };
}

describe('default theme', () => {
  beforeEach(() => window.localStorage.clear());
  afterAll(() => window.localStorage.clear());

  it('gives a first-time visitor with no stored choice the dark theme (FR2.1)', () => {
    expect(DEFAULT_THEME_ID).toBe('dark');
    expect(themeApi().getActiveThemeId()).toBe('dark');
  });

  it('keeps the choice a visitor made earlier (FR2.2)', () => {
    window.localStorage.setItem('theme', 'light');
    expect(themeApi().getActiveThemeId()).toBe('light');
  });

  it('still offers Backstage light and dark choice and lets the visitor switch (FR2.2)', () => {
    const api = themeApi();
    const installed = api.getInstalledThemes();
    expect(installed.map(theme => theme.id).sort()).toEqual(['dark', 'light']);
    expect(installed.map(theme => theme.variant).sort()).toEqual([
      'dark',
      'light',
    ]);
    api.setActiveThemeId('light');
    expect(api.getActiveThemeId()).toBe('light');
  });

  it('sets the default only when nothing is chosen, and writes nothing to storage itself (FR2.1)', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    try {
      const none = fakeThemeApi();
      expect(withDarkDefault(none.api)).toBe(none.api);
      expect(none.calls).toEqual(['dark']);

      const chosen = fakeThemeApi('light');
      withDarkDefault(chosen.api);
      expect(chosen.calls).toEqual([]);
      expect(chosen.api.getActiveThemeId()).toBe('light');

      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it('is carried by the existing sign-in module (FR4.3)', () => {
    const { extensions } = signInModule as unknown as {
      extensions: Array<{ id: string }>;
    };
    expect(extensions.map(extension => extension.id)).toContain(
      'api:app/app-theme',
    );
    expect(appFeatures).toContain(signInModule);
  });
});
