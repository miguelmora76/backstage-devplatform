import request from 'supertest';
import {
  mockCredentials,
  mockServices,
  startTestBackend,
} from '@backstage/backend-test-utils';
import plugin from './index';
import { createTestDatabases } from './testing/testDatabases';
import { startStandIn, type StandIn } from './testing/standInServer';

const databases = createTestDatabases();

describe('guardrails plugin', () => {
  let standIn: StandIn;

  beforeEach(async () => {
    standIn = await startStandIn();
  });

  afterEach(async () => {
    await standIn.close();
  });

  async function start(
    demoSignIn: boolean | undefined,
    url: string | undefined = standIn.url,
  ) {
    const knex = await databases.init('SQLITE_3');
    const backend = await startTestBackend({
      features: [
        plugin,
        mockServices.database.factory({ knex }),
        mockServices.rootConfig.factory({
          data: {
            guardrails: {
              ...(url ? { server: { url } } : {}),
              ...(demoSignIn === undefined
                ? {}
                : { demoSignIn: { enabled: demoSignIn } }),
            },
          },
        }),
      ],
    });
    return { backend, knex };
  }

  it('loads on the new backend system with plugin id guardrails and runs its migrations at start-up', async () => {
    expect(plugin.$$type).toBe('@backstage/BackendFeature');
    const { backend, knex } = await start(false);
    expect(await knex.schema.hasTable('changes')).toBe(true);
    expect(await knex.schema.hasTable('audit_entries')).toBe(true);
    await backend.stop();
  });

  it('serves the routes under /api/guardrails and takes the actor from the sign-in identity', async () => {
    const { backend } = await start(false);
    const me = await request(backend.server)
      .get('/api/guardrails/me')
      .set('Authorization', mockCredentials.user.header('user:default/priya'));
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('platform-engineer');

    const mock = await request(backend.server)
      .get('/api/guardrails/me')
      .set('Authorization', mockCredentials.user.header());
    expect(mock.status).toBe(401);

    const plan = await request(backend.server)
      .get('/api/guardrails/services/orders/plan')
      .set('Authorization', mockCredentials.user.header('user:default/sam'));
    expect(plan.status).toBe(200);
    await backend.stop();
  });

  it('offers the open demo user list only when the demo sign-in is on', async () => {
    const on = await start(true);
    const list = await request(on.backend.server).get(
      '/api/guardrails/demo-users',
    );
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(3);
    await on.backend.stop();

    const off = await start(undefined);
    const closed = await request(off.backend.server).get(
      '/api/guardrails/demo-users',
    );
    expect([401, 404]).toContain(closed.status);
    await off.backend.stop();
  });

  it('refuses to start without the server address', async () => {
    await expect(start(false, '')).rejects.toThrow(/guardrails\.server\.url/);
  });
});
