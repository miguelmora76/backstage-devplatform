import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import appPlugin from '@backstage/plugin-app';
import { prepareSpecializedApp } from '@backstage/frontend-app-api';
import { TestApiProvider, mockApis } from '@backstage/test-utils';
import {
  appThemeApiRef,
  createFrontendModule,
  errorApiRef,
  translationApiRef,
} from '@backstage/frontend-plugin-api';
import { UserSettingsThemeToggle } from '@backstage/plugin-user-settings';
import { appFeatures } from '../features';
import { darkDefaultThemeApi } from './defaultTheme';

// FR2.2: a visible light/dark choice, usable with the mouse and the keyboard.
// The settings page is Backstage's own (the user settings plugin, the fourth
// app feature); the choice is its theme toggle on the real theme API.
const themeModule = createFrontendModule({
  pluginId: 'app',
  extensions: [darkDefaultThemeApi],
});

function setup() {
  const { apis } = prepareSpecializedApp({
    features: [appPlugin, themeModule],
  }).getBootstrapApp();
  const themeApi = apis.get(appThemeApiRef)!;
  render(
    <TestApiProvider
      apis={[
        [appThemeApiRef, themeApi],
        [translationApiRef, mockApis.translation()],
        [errorApiRef, { post: jest.fn(), error$: jest.fn() }],
      ]}
    >
      <main>
        <ul>
          <UserSettingsThemeToggle />
        </ul>
      </main>
    </TestApiProvider>,
  );
  return themeApi;
}

describe('visible theme switch (FR2.2)', () => {
  beforeEach(() => window.localStorage.clear());
  afterAll(() => window.localStorage.clear());

  it('is a feature of the app: the user settings page is loaded and reachable', () => {
    const pluginIds = appFeatures.map(
      feature => (feature as { pluginId?: string }).pluginId,
    );
    expect(pluginIds).toContain('user-settings');
    const settings = appFeatures.find(
      feature =>
        (feature as { pluginId?: string }).pluginId === 'user-settings',
    ) as unknown as { extensions: Array<{ id: string }> };
    expect(settings.extensions.map(extension => extension.id)).toContain(
      'page:user-settings',
    );
  });

  it('starts on dark and offers Auto, Light and Dark choices', () => {
    const themeApi = setup();
    expect(themeApi.getActiveThemeId()).toBe('dark');
    for (const name of ['Light', 'Dark', 'Auto']) {
      expect(
        screen.getByRole('button', { name: new RegExp(name) }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /Dark/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('switches to light with the mouse', async () => {
    const themeApi = setup();
    await userEvent.click(screen.getByRole('button', { name: /Light/ }));
    expect(themeApi.getActiveThemeId()).toBe('light');
  });

  it('switches with the keyboard alone: Tab to the choice, then Enter or Space', async () => {
    const themeApi = setup();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /Dark/ })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /Light/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(themeApi.getActiveThemeId()).toBe('light');
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: /Dark/ })).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(themeApi.getActiveThemeId()).toBe('dark');
  });

  it('has no accessibility violation', async () => {
    setup();
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
