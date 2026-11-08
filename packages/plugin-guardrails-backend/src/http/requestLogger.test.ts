import express from 'express';
import request from 'supertest';
import { mockCredentials, mockServices } from '@backstage/backend-test-utils';
import { createFakeClock } from '../testing/fakeClock';
import { createTestDatabases } from '../testing/testDatabases';
import { createCapturingLogger, createHarness } from '../testing/harness';
import { createRequestLogger } from './requestLogger';
import { createRouter } from './router';

const databases = createTestDatabases();

describe('request logger', () => {
  function build() {
    const logger = createCapturingLogger();
    const clock = createFakeClock();
    const app = express();
    app.use(createRequestLogger({ logger, clock }));
    app.get('/services/:service/changes', (_req, res) => {
      res.locals.actorId = 'sam';
      res.json({});
    });
    app.get('/missing/:id', (_req, res) => {
      res.locals.actorId = 'priya';
      res.locals.errorCode = 'NOT_FOUND';
      res.status(404).json({});
    });
    return { app, logger };
  }

  it('writes one line per request with the fixed fields', async () => {
    const { app, logger } = build();
    await request(app).get('/services/orders/changes');
    expect(logger.lines).toHaveLength(1);
    expect(logger.lines[0]).toMatch(
      /^info Request time=2026-01-01T10:00:00\.000Z method=GET route=\/services\/:service\/changes actor=sam status=200 code=- durationMs=\d+$/,
    );
  });

  it('logs the route pattern, never the raw path or query values', async () => {
    const { app, logger } = build();
    await request(app).get(
      '/services/secret-service/changes?token=secret-query&reason=secret-reason',
    );
    const line = logger.lines.join('\n');
    expect(line).not.toContain('secret-service');
    expect(line).not.toContain('secret-query');
    expect(line).not.toContain('secret-reason');
    expect(line).toContain('route=/services/:service/changes');
  });

  it('records the actor and error code of a refused request, and a placeholder for an unmatched route', async () => {
    const { app, logger } = build();
    await request(app).get('/missing/abc');
    await request(app).get('/nothing/here');
    expect(logger.lines[0]).toContain('actor=priya status=404 code=NOT_FOUND');
    expect(logger.lines[1]).toContain('route=unmatched actor=- status=404');
  });
});

describe('request log of a full run', () => {
  it('holds no reason text, setting value, login or token', async () => {
    const h = await createHarness(databases, 'SQLITE_3');
    try {
      const app = express();
      app.use(
        createRouter({
          httpAuth: mockServices.httpAuth({
            defaultCredentials: mockCredentials.none(),
          }),
          workflow: h.workflow,
          logger: h.logger,
          clock: h.clock,
          demoSignInEnabled: true,
        }),
      );
      const header = (id: string) => ({
        Authorization: mockCredentials.user.header(`user:default/${id}`),
      });
      const proposed = await request(app)
        .post('/services/orders/changes')
        .set(header('sam'))
        .send({ kind: 'upgrade', target: 'dep-1' });
      await request(app)
        .post(`/changes/${proposed.body.changeId}/approve`)
        .set(header('priya'))
        .send({ reason: 'TOP-SECRET-REASON-TEXT' });
      await request(app)
        .post(`/changes/${proposed.body.changeId}/reject`)
        .set(header('alex'))
        .send({ reason: 'ANOTHER-SECRET-REASON' });
      await request(app)
        .get('/services/orders/audit?actor=SECRET-FILTER')
        .set(header('alex'));
      await request(app)
        .get('/services/orders/changes')
        .set({ Authorization: 'Bearer very-secret-token' });

      const log = h.logger.lines.join('\n');
      expect(log).toContain('route=/changes/:changeId/approve');
      for (const secret of [
        'TOP-SECRET-REASON-TEXT',
        'ANOTHER-SECRET-REASON',
        'SECRET-FILTER',
        'very-secret-token',
        h.standIn.url,
        'postgresql://',
        mockCredentials.user.header('user:default/sam'),
      ]) {
        expect(log).not.toContain(secret);
      }
      const requestLines = h.logger.lines.filter(l =>
        l.startsWith('info Request '),
      );
      expect(requestLines).toHaveLength(5);
    } finally {
      await h.close();
    }
  });
});
