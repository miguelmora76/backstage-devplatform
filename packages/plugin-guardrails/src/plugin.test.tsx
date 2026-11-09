import {
  clientFactory,
  guardrailsPlugin,
  loadCard,
  loadTab,
  rootRouteRef,
} from './plugin';
import { GuardrailsApi } from './api/guardrailsApi';
import { DemoSession } from './api/demoSession';
import { GuardrailsTab } from './screens/GuardrailsTab';
import { OverviewCardEntity } from './screens/OverviewCardEntity';

describe('guardrails frontend plugin (contract C3, NFR2.2, NFR2.7)', () => {
  it('has the plugin id guardrails', () => {
    expect(guardrailsPlugin.pluginId).toBe('guardrails');
  });

  it('declares the entity tab, the overview card and the plugin api', () => {
    const tab = guardrailsPlugin.getExtension('entity-content:guardrails');
    const card = guardrailsPlugin.getExtension('entity-card:guardrails');
    const api = guardrailsPlugin.getExtension('api:guardrails/client');
    expect(tab).toBeDefined();
    expect(card).toBeDefined();
    expect(api).toBeDefined();
  });

  it('exposes one route for the tab, used by the card link', () => {
    expect(guardrailsPlugin.routes.root).toBe(rootRouteRef);
  });

  it('does not load the screens when the plugin is defined (NFR1.7)', () => {
    let loaded = false;
    jest.isolateModules(() => {
      jest.doMock('./screens/GuardrailsTab', () => {
        loaded = true;
        return { GuardrailsTab: () => null };
      });
      jest.doMock('./screens/OverviewCardEntity', () => {
        loaded = true;
        return { OverviewCardEntity: () => null };
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./plugin');
    });
    expect(loaded).toBe(false);
    jest.dontMock('./screens/GuardrailsTab');
    jest.dontMock('./screens/OverviewCardEntity');
  });

  it('loads the tab and the card screens only when asked, as lazy imports', async () => {
    const tab = await loadTab();
    const card = await loadCard();
    expect(tab.type).toBe(GuardrailsTab);
    expect(card.type).toBe(OverviewCardEntity);
  });

  it('builds the API and the session from discovery and fetch, with no address in the plugin (NFR5.11)', async () => {
    const getBaseUrl = jest.fn(async (id: string) => `http://x.test/api/${id}`);
    const client = clientFactory({
      discoveryApi: { getBaseUrl },
      fetchApi: {
        fetch: async () => {
          throw new Error('offline');
        },
      },
    });
    expect(client.api).toBeInstanceOf(GuardrailsApi);
    expect(client.session).toBeInstanceOf(DemoSession);
    await client.session.ready;
    expect(getBaseUrl).toHaveBeenCalledWith('guardrails');
  });
});
