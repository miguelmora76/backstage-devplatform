import express from 'express';
import request from 'supertest';
import { GuardrailsError } from '../errors';
import { createCapturingLogger } from '../testing/harness';
import { createErrorHandler } from './errorHandler';

function build() {
  const logger = createCapturingLogger();
  const app = express();
  app.use(express.json());
  app.get('/boom', () => {
    throw new Error("select * from changes where password = 'hunter2'");
  });
  app.get('/async-boom', (_req, _res, next) => {
    Promise.reject(
      Object.assign(new TypeError('connection string postgresql://u:p@db/x'), {
        stack: 'Error: leaked\n    at secret/file.ts:1:1',
      }),
    ).catch(next);
  });
  app.get('/typed', () => {
    throw new GuardrailsError('CLAIM_RELEASED');
  });
  app.post('/body', (_req, res) => {
    res.json({});
  });
  app.use(createErrorHandler({ logger }));
  return { app, logger };
}

describe('error handler', () => {
  it('answers any unexpected error with a fixed 500 and no detail', async () => {
    const { app } = build();
    for (const path of ['/boom', '/async-boom']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/select|hunter2|postgresql|stack|secret/i);
    }
  });

  it('logs the error class and the route, not the message', async () => {
    const { app, logger } = build();
    await request(app).get('/boom');
    await request(app).get('/async-boom');
    const log = logger.lines.join('\n');
    expect(log).toContain('errorClass');
    expect(log).toContain('Error');
    expect(log).toContain('TypeError');
    expect(log).toContain('/boom');
    expect(log).not.toMatch(/select|hunter2|postgresql|secret/i);
  });

  it('maps a defined error to its status and code, with its fixed message', async () => {
    const { app } = build();
    const res = await request(app).get('/typed');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CLAIM_RELEASED');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('maps malformed or oversized JSON to 400 INVALID_INPUT without echoing it', async () => {
    const { app } = build();
    const bad = await request(app)
      .post('/body')
      .set('content-type', 'application/json')
      .send('{"a": nope');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_INPUT');
    expect(JSON.stringify(bad.body)).not.toContain('nope');
  });

  it('exposes the error code to the request logger through res.locals', async () => {
    const logger = createCapturingLogger();
    const seen: unknown[] = [];
    const app = express();
    app.use((_req, res, next) => {
      res.on('finish', () => seen.push(res.locals.errorCode));
      next();
    });
    app.get('/typed', () => {
      throw new GuardrailsError('NOT_FOUND');
    });
    app.get('/boom', () => {
      throw new Error('x');
    });
    app.use(createErrorHandler({ logger }));
    expect((await request(app).get('/typed')).status).toBe(404);
    expect((await request(app).get('/boom')).status).toBe(500);
    expect(seen).toEqual(['NOT_FOUND', 'INTERNAL_ERROR']);
  });
});
