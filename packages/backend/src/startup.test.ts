import { join } from 'node:path';
import {
  mockCredentials,
  mockServices,
  startTestBackend,
  type TestBackend,
} from '@backstage/backend-test-utils';
import { backendFeatures } from './features';
import {
  createRecordingLogger,
  type LogRecorder,
} from './testing/recordingLogger';
import { loadShippedConfig } from './testing/shippedConfig';
import {
  startStandInGuardrails,
  type StandInGuardrails,
} from './testing/standInGuardrails';

const DB_PASSWORD = 'db-password-for-the-test-only';
const READINESS = '/.backstage/health/v1/readiness';

interface Started {
  backend: TestBackend;
  recorder: LogRecorder;
  get(path: string, authorization?: string, origin?: string): Promise<Response>;
  post(path: string, body: unknown, authorization: string): Promise<Response>;
}

describe('the app backend starts with the real features (NFR2.3)', () => {
  let standIn: StandInGuardrails;
  const running: TestBackend[] = [];

  beforeEach(async () => {
    standIn = await startStandInGuardrails();
  });

  afterEach(async () => {
    await Promise.all(running.splice(0).map(backend => backend.stop()));
    await standIn.close();
  });

  async function start(options: {
    demo: boolean;
    serverUrl?: string;
  }): Promise<Started> {
    const config = loadShippedConfig(
      {
        GUARDRAILS_SERVER_URL: options.serverUrl ?? standIn.url,
        GUARDRAILS_DEMO_SIGN_IN: options.demo ? 'true' : '',
      },
      // The tests may run from the package folder or the repository root.
      join(__dirname, '..'),
    );
    const { recorder, factory } = createRecordingLogger();
    const backend = await startTestBackend({
      features: [
        ...backendFeatures,
        factory,
        mockServices.rootConfig.factory({
          data: {
            ...config,
            // A database password in the settings, to prove it never reaches the log.
            secrets: { databasePassword: DB_PASSWORD },
          },
        }),
      ],
    });
    running.push(backend);
    const base = `http://127.0.0.1:${backend.server.port()}`;
    return {
      backend,
      recorder,
      get: (path, authorization, origin) =>
        fetch(`${base}${path}`, {
          headers: {
            ...(authorization ? { authorization } : {}),
            ...(origin ? { origin } : {}),
          },
        }),
      post: (path, body, authorization) =>
        fetch(`${base}${path}`, {
          method: 'POST',
          headers: { authorization, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
    };
  }

  const sam = mockCredentials.user.header('user:default/sam');

  it('loads the catalog, the auth backend, the guardrails plugin and its sign-in module and nothing else (BR1.1)', async () => {
    expect(backendFeatures).toHaveLength(5);
  });

  it('answers the readiness route with 200 once everything has started (NFR7.4, BR5.1)', async () => {
    const app = await start({ demo: false });
    const response = await app.get(READINESS);
    expect(response.status).toBe(200);
  });

  it('serves the open user list with the switch on and logs the warning once (NFR5.2, NFR1.8)', async () => {
    const app = await start({ demo: true });
    const response = await app.get('/api/guardrails/demo-users');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ userId: string }>;
    };
    expect(body.items.map(user => user.userId).sort()).toEqual([
      'alex',
      'priya',
      'sam',
    ]);
    const warnings = app.recorder.lines.filter(
      line => line.level === 'warn' && line.text.includes('demo sign-in is on'),
    );
    expect(warnings).toHaveLength(1);
  });

  it('refuses the user list with the switch off: 401 signed out, 404 signed in, no warning (NFR5.2, BR2.1)', async () => {
    const app = await start({ demo: false });
    expect((await app.get('/api/guardrails/demo-users')).status).toBe(401);
    expect((await app.get('/api/guardrails/demo-users', sam)).status).toBe(404);
    expect(app.recorder.text()).not.toContain('demo sign-in is on');
  });

  it('refuses to start without the server address and names the setting (NFR7.2, BR4.1)', async () => {
    await expect(start({ demo: false, serverUrl: '' })).rejects.toThrow(
      /guardrails\.server\.url/,
    );
  });

  it('gives 401 to a service principal, an unknown user and no one, and 200 to a demo user (NFR5.1)', async () => {
    const app = await start({ demo: true });
    const route = '/api/guardrails/me';
    expect(
      (await app.get(route, mockCredentials.service.header())).status,
    ).toBe(401);
    expect(
      (
        await app.get(
          route,
          mockCredentials.user.header('user:default/mallory'),
        )
      ).status,
    ).toBe(401);
    expect((await app.get(route)).status).toBe(401);
    const ok = await app.get(route, sam);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ userId: 'sam' });
  });

  it('stays up when the guardrails server is not running: open routes work, server routes answer 503 (NFR7.3)', async () => {
    const dead = await startStandInGuardrails();
    const deadUrl = dead.url;
    await dead.close();
    const app = await start({ demo: true, serverUrl: deadUrl });
    expect((await app.get(READINESS)).status).toBe(200);
    expect((await app.get('/api/guardrails/demo-users')).status).toBe(200);
    expect(
      (await app.get('/api/guardrails/services/orders/plan', sam)).status,
    ).toBe(503);
  });

  it('writes no token, password or reason text to the log (NFR1.9, NFR5.3)', async () => {
    const app = await start({ demo: true });
    const reason = 'reason-text-that-must-not-be-logged';
    await app.get('/api/guardrails/me', sam);
    await app.post(
      '/api/guardrails/services/orders/changes',
      { kind: 'upgrade', target: '1.0.0', reason },
      sam,
    );
    const log = app.recorder.text();
    expect(log.length).toBeGreaterThan(0);
    expect(log).not.toContain(DB_PASSWORD);
    expect(log).not.toContain(reason);
    expect(log).not.toContain(sam.replace('Bearer ', ''));
  });

  it('signs a chosen demo user in through the real auth backend and answers the identity and token (D8, D9)', async () => {
    const app = await start({ demo: true });
    const response = await app.get('/api/auth/demo/start?userId=priya');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      profile: { displayName: string };
      backstageIdentity: { token: string; identity: { userEntityRef: string } };
    };
    expect(body.profile.displayName).toBe('Priya');
    expect(body.backstageIdentity.identity.userEntityRef).toBe(
      'user:default/priya',
    );
    expect(body.backstageIdentity.token.length).toBeGreaterThan(20);
    expect((await app.get('/api/auth/demo/start?userId=mallory')).status).toBe(
      401,
    );
  });

  it('offers no way to sign in at the start address while the switch is off, although the provider is named in the settings (NFR5.2, BR2.1)', async () => {
    const app = await start({ demo: false });
    const response = await app.get('/api/auth/demo/start?userId=sam');
    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).not.toContain('token');
  });

  it('never allows the origin of another site (NFR5.6)', async () => {
    // Backstage's test backend replaces the root HTTP router and applies no
    // CORS or content-policy middleware (observed in Code Generation: no
    // Access-Control-* or Content-Security-Policy header at all). So this
    // test can only prove the negative; that the app's own origin IS allowed
    // and that the policy header is sent is checked by u5's compose run
    // (see code-summary.md, hand-offs).
    const app = await start({ demo: true });
    const other = await app.get(
      '/api/guardrails/demo-users',
      undefined,
      'https://other.example',
    );
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});
