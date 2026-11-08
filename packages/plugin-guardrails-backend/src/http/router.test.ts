import express from 'express';
import request from 'supertest';
import { mockCredentials, mockServices } from '@backstage/backend-test-utils';
import { createTestDatabases } from '../testing/testDatabases';
import { createHarness, sam, type Harness } from '../testing/harness';
import { createRouter } from './router';

const databases = createTestDatabases();

const as = (userId: string) => ({
  Authorization: mockCredentials.user.header(`user:default/${userId}`),
});

describe.each(databases.eachSupportedId())('router on %s', dbId => {
  let h: Harness;
  let app: express.Express;

  function build(demoSignInEnabled = true) {
    const router = createRouter({
      httpAuth: mockServices.httpAuth({
        defaultCredentials: mockCredentials.none(),
      }),
      workflow: h.workflow,
      logger: h.logger,
      clock: h.clock,
      demoSignInEnabled,
    });
    app = express();
    app.use(router);
  }

  beforeEach(async () => {
    h = await createHarness(databases, dbId);
    build();
  });

  afterEach(async () => {
    await h.close();
  });

  const entries = async () =>
    (await h.audit.read('orders', { pageSize: 100 })).items;
  const propose = async (
    userId = 'sam',
    body: object = { kind: 'upgrade', target: 'dep-1' },
  ) => request(app).post('/services/orders/changes').set(as(userId)).send(body);

  describe('identity (W1, W8)', () => {
    it('GET /me returns the signed-in demo user', async () => {
      const res = await request(app).get('/me').set(as('priya'));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        userId: 'priya',
        name: 'Priya',
        role: 'platform-engineer',
      });
    });

    it('serves the open demo user list without sign-in only while the demo sign-in is on', async () => {
      const on = await request(app).get('/demo-users');
      expect(on.status).toBe(200);
      expect(on.body.items.map((u: { userId: string }) => u.userId)).toEqual([
        'sam',
        'priya',
        'alex',
      ]);
      expect(Object.keys(on.body.items[0]).sort()).toEqual([
        'name',
        'role',
        'userId',
      ]);

      build(false);
      // Not registered: no open access, and not even a signed-in user finds it.
      expect((await request(app).get('/demo-users')).status).toBe(401);
      expect(
        (await request(app).get('/demo-users').set(as('sam'))).status,
      ).toBe(404);
    });

    it.each([
      ['no identity', {}],
      [
        'an invalid token',
        { Authorization: mockCredentials.user.invalidHeader() },
      ],
      ['an unknown user', as('guest')],
      [
        'a user of another namespace',
        { Authorization: mockCredentials.user.header('user:other/sam') },
      ],
      [
        'a service principal',
        { Authorization: mockCredentials.service.header() },
      ],
    ])(
      'answers 401 and writes nothing for %s on every route',
      async (_label, headers) => {
        const routes: Array<['get' | 'post', string]> = [
          ['get', '/me'],
          ['get', '/services/orders/plan'],
          ['get', '/services/orders/ci-runs'],
          ['get', '/services/orders/changes'],
          ['post', '/services/orders/changes'],
          ['get', '/changes/x'],
          ['post', '/changes/x/approve'],
          ['post', '/changes/x/reject'],
          ['post', '/changes/x/retry'],
          ['get', '/services/orders/audit'],
        ];
        for (const [method, path] of routes) {
          const res = await request(app)[method](path).set(headers).send({
            kind: 'upgrade',
            target: 'dep-1',
            reason: 'x',
          });
          expect(res.status).toBe(401);
          expect(res.body.error.code).toBe('UNAUTHENTICATED');
        }
        expect(await entries()).toEqual([]);
        expect(await h.workflow.listChanges(sam, 'orders', 'open')).toEqual([]);
      },
    );

    it('ignores any actor or role in the body, query or headers', async () => {
      const res = await request(app)
        .post('/services/orders/changes?actor=priya&role=platform-engineer')
        .set({
          ...as('sam'),
          'x-actor': 'priya',
          'x-role': 'platform-engineer',
        })
        .send({
          kind: 'upgrade',
          target: 'dep-1',
          actor: 'priya',
          role: 'platform-engineer',
        });
      expect(res.status).toBe(201);
      expect(res.body.proposedBy.userId).toBe('sam');
      expect((await entries())[0].actor).toBe('sam');

      const forged = await request(app)
        .post('/services/orders/changes')
        .set(as('alex'))
        .send({
          kind: 'upgrade',
          target: 'dep-1',
          actor: 'sam',
          role: 'service-owner',
        });
      expect(forged.status).toBe(403);
      expect(forged.body.error.code).toBe('AUDITOR_READ_ONLY');
    });
  });

  describe('plan and failed runs (W6)', () => {
    it('relays the plan with allowed actions', async () => {
      const res = await request(app)
        .get('/services/orders/plan')
        .set(as('sam'));
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('orders');
      expect(res.body.items[1].allowedActions).toEqual([
        { action: 'propose', allowed: false, reason: 'ALREADY_CURRENT' },
      ]);
    });

    it('relays the failed runs, with an empty list for a service with none', async () => {
      const res = await request(app)
        .get('/services/orders/ci-runs')
        .set(as('priya'));
      expect(res.body.items).toHaveLength(1);
      const empty = await request(app)
        .get('/services/billing/ci-runs')
        .set(as('priya'));
      expect(empty.body).toEqual({ service: 'billing', items: [] });
    });

    it('answers 404 for an unknown service and 503 when the server cannot be used', async () => {
      const unknown = await request(app)
        .get('/services/nowhere/plan')
        .set(as('sam'));
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.code).toBe('NOT_FOUND');

      h.standIn.setHealthy(false);
      h.health.reset();
      const down = await request(app)
        .get('/services/orders/ci-runs')
        .set(as('sam'));
      expect(down.status).toBe(503);
      expect(down.body.error.code).toBe('SERVER_UNREACHABLE');
    });
  });

  describe('changes and propose (W2, W5)', () => {
    it('proposes with 201 and the change, then lists it as open', async () => {
      const res = await propose();
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        kind: 'upgrade',
        status: 'pending',
        summary: 'Upgrade lodash from 4.0.0 to 4.17.21',
      });
      const list = await request(app)
        .get('/services/orders/changes')
        .set(as('priya'));
      expect(list.status).toBe(200);
      expect(list.body.service).toBe('orders');
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0].allowedActions[0]).toEqual({
        action: 'approve',
        allowed: true,
      });
    });

    it('filters by status and refuses unknown statuses with 400', async () => {
      await propose();
      const applied = await request(app)
        .get('/services/orders/changes?status=applied')
        .set(as('sam'));
      expect(applied.body.items).toEqual([]);
      const bad = await request(app)
        .get('/services/orders/changes?status=deciding')
        .set(as('sam'));
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('INVALID_INPUT');
    });

    it('answers 403, 404, 409 and 503 with the codes of contract C1', async () => {
      const auditor = await propose('alex');
      expect([auditor.status, auditor.body.error.code]).toEqual([
        403,
        'AUDITOR_READ_ONLY',
      ]);

      const missing = await propose('sam', { kind: 'upgrade', target: 'nope' });
      expect([missing.status, missing.body.error.code]).toEqual([
        404,
        'NOT_FOUND',
      ]);

      const eligible = await propose('sam', {
        kind: 'upgrade',
        target: 'dep-2',
      });
      expect([eligible.status, eligible.body.error.code]).toEqual([
        409,
        'NOT_ELIGIBLE',
      ]);

      h.standIn.setHealthy(false);
      h.health.reset();
      const down = await propose();
      expect([down.status, down.body.error.code]).toEqual([
        503,
        'SERVER_UNREACHABLE',
      ]);
    });

    it('answers 400 INVALID_INPUT for a bad kind or target and writes nothing', async () => {
      for (const body of [
        { kind: 'delete', target: 'dep-1' },
        { kind: 'upgrade' },
        {},
        'text',
      ]) {
        const res = await propose('sam', body as object);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_INPUT');
      }
      expect(await entries()).toEqual([]);
    });

    it('answers 400 on malformed JSON without echoing it', async () => {
      const res = await request(app)
        .post('/services/orders/changes')
        .set(as('sam'))
        .set('content-type', 'application/json')
        .send('{"kind": "upgrade", oops');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_INPUT');
      expect(JSON.stringify(res.body)).not.toContain('oops');
    });

    it('treats hostile text in the path as a plain service name', async () => {
      const hostile = encodeURIComponent(`x'; drop table changes; --`);
      const res = await request(app)
        .get(`/services/${hostile}/changes`)
        .set(as('sam'));
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      const audit = await request(app)
        .get(`/services/${hostile}/audit?actor=${hostile}`)
        .set(as('sam'));
      expect(audit.status).toBe(200);
    });

    it('reads one change and answers 404 for an unknown one', async () => {
      const { body } = await propose();
      const one = await request(app)
        .get(`/changes/${body.changeId}`)
        .set(as('alex'));
      expect(one.status).toBe(200);
      expect(
        one.body.allowedActions.every(
          (a: { reason: string }) => a.reason === 'AUDITOR_READ_ONLY',
        ),
      ).toBe(true);
      const missing = await request(app)
        .get('/changes/missing')
        .set(as('alex'));
      expect(missing.status).toBe(404);
    });

    it('never returns the deciding state: it shows the previous status and IN_PROGRESS', async () => {
      const { body } = await propose();
      await h.changes.claim(body.changeId, {
        expectedStatus: 'pending',
        token: 'busy',
        at: h.clock().toISOString(),
        by: 'priya',
        action: 'approve',
        reason: 'working',
      });
      const one = await request(app)
        .get(`/changes/${body.changeId}`)
        .set(as('alex'));
      expect(one.body.status).toBe('pending');
      const mine = await request(app)
        .get(`/changes/${body.changeId}`)
        .set(as('priya'));
      expect(
        mine.body.allowedActions.map((a: { reason: string }) => a.reason),
      ).toEqual(['IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS']);
    });

    it('reads changes while the server is down', async () => {
      await propose();
      h.standIn.setHealthy(false);
      h.health.reset();
      const res = await request(app)
        .get('/services/orders/changes')
        .set(as('priya'));
      expect(res.status).toBe(200);
      expect(
        res.body.items[0].allowedActions.every(
          (a: { reason: string }) => a.reason === 'SERVER_UNREACHABLE',
        ),
      ).toBe(true);
    });
  });

  describe('decisions (W3, W4)', () => {
    const decide = (
      action: string,
      id: string,
      userId: string,
      body: object = { reason: 'because' },
    ) =>
      request(app).post(`/changes/${id}/${action}`).set(as(userId)).send(body);

    it('approve answers 200 with the applied change; reject and retry follow the same shape', async () => {
      const a = (await propose()).body.changeId;
      const approved = await decide('approve', a, 'priya', {
        reason: '  as typed ',
        actor: 'sam',
      });
      expect(approved.status).toBe(200);
      expect(approved.body).toMatchObject({
        status: 'applied',
        decisionReason: '  as typed ',
      });

      const rerun = { kind: 'rerun', target: 'run-1' };
      const b = (await propose('sam', rerun)).body.changeId;
      const rejected = await decide('reject', b, 'priya');
      expect(rejected.body.status).toBe('rejected');

      const c = (await propose('sam', rerun)).body.changeId;
      h.standIn.setFailureMode(true);
      const failed = await decide('approve', c, 'priya');
      expect(failed.status).toBe(200);
      expect(failed.body.status).toBe('failed');
      h.standIn.setFailureMode(false);
      const retried = await decide('retry', c, 'priya');
      expect(retried.status).toBe(200);
      expect(retried.body.status).toBe('applied');
    });

    it('answers 400 EMPTY_REASON and writes nothing for a blank reason', async () => {
      const id = (await propose()).body.changeId;
      const before = (await entries()).length;
      const res = await decide('approve', id, 'priya', { reason: '   ' });
      expect([res.status, res.body.error.code]).toEqual([400, 'EMPTY_REASON']);
      expect(await entries()).toHaveLength(before);
    });

    it('answers 400 INVALID_INPUT for a reason over 2,000 characters, for every user, and writes nothing', async () => {
      const id = (await propose()).body.changeId;
      const before = (await entries()).length;
      for (const user of ['priya', 'alex', 'sam']) {
        const res = await decide('reject', id, user, {
          reason: 'x'.repeat(2001),
        });
        expect([res.status, res.body.error.code]).toEqual([
          400,
          'INVALID_INPUT',
        ]);
      }
      const ok = await decide('reject', id, 'priya', {
        reason: 'x'.repeat(2000),
      });
      expect(ok.status).toBe(200);
      expect(await entries()).toHaveLength(before + 1);
    });

    it('answers 403 for the auditor and the proposer, 404 for unknown, 409 for state errors, 503 for an outage', async () => {
      const id = (await propose()).body.changeId;
      expect((await decide('approve', id, 'alex')).body.error.code).toBe(
        'AUDITOR_READ_ONLY',
      );
      expect((await decide('approve', id, 'sam')).body.error.code).toBe(
        'SELF_DECISION',
      );
      expect((await decide('approve', 'missing', 'priya')).status).toBe(404);
      const notFailed = await decide('retry', id, 'priya');
      expect([notFailed.status, notFailed.body.error.code]).toEqual([
        409,
        'NOT_FAILED',
      ]);

      await decide('approve', id, 'priya');
      const again = await decide('reject', id, 'priya');
      expect([again.status, again.body.error.code]).toEqual([
        409,
        'ALREADY_DECIDED',
      ]);

      const other = (await propose('sam', { kind: 'rerun', target: 'run-1' }))
        .body.changeId;
      h.standIn.setHealthy(false);
      h.health.reset();
      const down = await decide('reject', other, 'priya');
      expect([down.status, down.body.error.code]).toEqual([
        503,
        'SERVER_UNREACHABLE',
      ]);
    });
  });

  describe('audit log (W7)', () => {
    it('reads newest first, scoped, filtered and paged, while the server is down', async () => {
      const id = (await propose()).body.changeId;
      await request(app)
        .post(`/changes/${id}/approve`)
        .set(as('priya'))
        .send({ reason: 'ok' });
      h.standIn.setHealthy(false);
      h.health.reset();

      const all = await request(app)
        .get('/services/orders/audit')
        .set(as('alex'));
      expect(all.status).toBe(200);
      expect(all.body).toMatchObject({ page: 1, pageSize: 20, total: 2 });
      expect(all.body.items[0]).toMatchObject({
        action: 'approve',
        outcome: 'applied',
        actor: { userId: 'priya', role: 'platform-engineer' },
        reason: 'ok',
      });
      expect(all.body.items[0].decisionNumber).toBeUndefined();

      const filtered = await request(app)
        .get(
          '/services/orders/audit?actor=sam&outcome=proposed&pageSize=1&unknown=1',
        )
        .set(as('alex'));
      expect(filtered.body.items).toHaveLength(1);
      expect(filtered.body.pageSize).toBe(1);

      const empty = await request(app)
        .get('/services/billing/audit')
        .set(as('alex'));
      expect(empty.body).toMatchObject({ items: [], total: 0 });
    });

    it('refuses page ranges with 400 instead of clamping them', async () => {
      for (const q of [
        'page=0',
        'pageSize=0',
        'pageSize=101',
        'pageSize=abc',
        'from=yesterday',
      ]) {
        const res = await request(app)
          .get(`/services/orders/audit?${q}`)
          .set(as('alex'));
        expect([res.status, res.body.error.code]).toEqual([
          400,
          'INVALID_INPUT',
        ]);
      }
    });

    it('offers no write, edit or delete route', async () => {
      for (const method of ['post', 'put', 'patch', 'delete'] as const) {
        const res = await request(app)
          [method]('/services/orders/audit')
          .set(as('priya'))
          .send({});
        expect(res.status).toBe(404);
      }
    });
  });
});
