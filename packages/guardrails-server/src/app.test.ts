import fs from 'node:fs';
import * as path from 'node:path';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createApp, healthResponse } from './app';
import { ERROR_MESSAGES } from './errors';
import { DEFAULT_SEED, generateDataSet } from './generator';
import { createLogger } from './logger';
import { startTestServer, type TestServer } from './testing/testServer';

const dataSet = generateDataSet(DEFAULT_SEED);
const behind = dataSet.dependencies.find(
  d => d.currentVersion !== d.recommendedVersion,
)!;
const failed = dataSet.ciRuns.find(r => r.status === 'failed')!;

async function call(
  client: Client,
  name: string,
  args?: Record<string, unknown>,
): Promise<CallToolResult> {
  return (await client.callTool({
    name,
    arguments: args,
  })) as CallToolResult;
}

describe('server over streamable HTTP: the four tools', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('lists exactly the four tools (NFR5.1)', async () => {
    const { tools } = await server.client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual([
      'apply_dependency_upgrade',
      'list_failed_ci_runs',
      'list_upgrade_plan',
      'rerun_ci_job',
    ]);
    const apply = tools.find(t => t.name === 'apply_dependency_upgrade')!;
    expect(Object.keys(apply.inputSchema.properties ?? {}).sort()).toEqual([
      'dependencyKey',
      'service',
    ]);
  });

  it('returns plan and failed-run data consistent with the seed (FR6.1)', async () => {
    for (const { serviceName } of dataSet.services) {
      const plan = await call(server.client, 'list_upgrade_plan', {
        service: serviceName,
      });
      expect(plan.isError).toBeFalsy();
      const seeded = dataSet.dependencies
        .filter(d => d.serviceName === serviceName)
        .map(d => d.name)
        .sort();
      const listed = (
        plan.structuredContent as { dependencies: Array<{ name: string }> }
      ).dependencies.map(d => d.name);
      expect(listed).toEqual(seeded);

      const runs = await call(server.client, 'list_failed_ci_runs', {
        service: serviceName,
      });
      const seededFailed = dataSet.ciRuns.filter(
        r => r.serviceName === serviceName && r.status === 'failed',
      ).length;
      expect((runs.structuredContent as { runs: unknown[] }).runs).toHaveLength(
        seededFailed,
      );
    }
  });

  it('applies an upgrade and re-runs a job, and repeats are safe', async () => {
    const apply = {
      service: behind.serviceName,
      dependencyKey: behind.dependencyKey,
    };
    const first = await call(server.client, 'apply_dependency_upgrade', apply);
    expect(first.structuredContent).toMatchObject({ result: 'applied' });
    const second = await call(server.client, 'apply_dependency_upgrade', apply);
    expect(second.structuredContent).toMatchObject({
      result: 'already-current',
    });
    const rerun = { service: failed.serviceName, runKey: failed.runKey };
    const a = await call(server.client, 'rerun_ci_job', rerun);
    const b = await call(server.client, 'rerun_ci_job', rerun);
    expect(a.structuredContent).toEqual(b.structuredContent);
    const runs = await call(server.client, 'list_failed_ci_runs', {
      service: failed.serviceName,
    });
    expect(
      (runs.structuredContent as { runs: Array<{ runKey: string }> }).runs.some(
        r => r.runKey === failed.runKey,
      ),
    ).toBe(false);
  });

  it('lets bad input reach the handler instead of being rejected by the kit (NFR5.3)', async () => {
    const wrongType = await call(server.client, 'list_upgrade_plan', {
      service: 7,
    });
    expect(wrongType.isError).toBe(true);
    expect(wrongType.structuredContent).toEqual({
      code: 'INVALID_INPUT',
      message: ERROR_MESSAGES.INVALID_INPUT,
    });
    const missing = await call(server.client, 'rerun_ci_job');
    expect(missing.structuredContent).toMatchObject({ code: 'INVALID_INPUT' });
    const extra = await call(server.client, 'list_upgrade_plan', {
      service: behind.serviceName,
      unexpected: ['x'],
    });
    expect(extra.isError).toBeFalsy();
    const unknown = await call(server.client, 'list_upgrade_plan', {
      service: '<script>alert(1)</script>',
    });
    expect(unknown.structuredContent).toEqual({
      code: 'UNKNOWN_SERVICE',
      message: ERROR_MESSAGES.UNKNOWN_SERVICE,
    });
  });

  it('refuses a tool that is not one of the four before any handler runs', async () => {
    const before = server.lines.length;
    let refused = false;
    try {
      const result = await call(server.client, 'dump_everything', {});
      refused = result.isError === true;
    } catch {
      refused = true;
    }
    expect(refused).toBe(true);
    expect(server.lines).toHaveLength(before);
  });

  it('writes one log line per tool call (NFR1.6)', async () => {
    const before = server.lines.length;
    await call(server.client, 'list_upgrade_plan', {
      service: behind.serviceName,
    });
    await call(server.client, 'list_upgrade_plan', { service: 'x y' });
    expect(server.lines.slice(before)).toHaveLength(2);
    expect(server.lines[before]).toContain(
      `tool=list_upgrade_plan service=${behind.serviceName} result=ok`,
    );
    expect(server.lines[before + 1]).toContain(
      'service=- result=UNKNOWN_SERVICE',
    );
  });
});

describe('server over streamable HTTP: routes', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('answers the health check with the C4 body once ready (BR4.1)', async () => {
    const response = await fetch(`${server.baseUrl}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('refuses any other path or method with a fixed body that echoes nothing (NFR5.1)', async () => {
    const attempts: Array<[string, string]> = [
      ['GET', '/'],
      ['GET', '/data'],
      ['GET', '/seed-data-set.json'],
      ['GET', '/<script>alert(1)</script>'],
      ['GET', '/mcp'],
      ['DELETE', '/mcp'],
      ['PUT', '/mcp'],
      ['POST', '/healthz'],
      ['HEAD', '/healthz'],
    ];
    for (const [method, route] of attempts) {
      const response = await fetch(`${server.baseUrl}${route}`, { method });
      expect([404, 405]).toContain(response.status);
      const body = await response.text();
      expect(method === 'HEAD' ? '{}' : body).toMatch(/^\{.*\}$/);
      expect(body).not.toContain('script');
      expect(body).not.toContain('seed-data-set');
      expect(body.length).toBeLessThan(80);
    }
    const notFound = await fetch(`${server.baseUrl}/anything?x=1`);
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ error: 'not found' });
    const wrongMethod = await fetch(`${server.baseUrl}/healthz`, {
      method: 'POST',
    });
    expect(wrongMethod.status).toBe(405);
    expect(await wrongMethod.json()).toEqual({ error: 'method not allowed' });
  });

  it('survives a request body that is not valid JSON-RPC', async () => {
    const response = await fetch(`${server.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: '{ not json',
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    const after = await fetch(`${server.baseUrl}/healthz`);
    expect(after.status).toBe(200);
  });
});

describe('health and readiness', () => {
  it('builds the not-ready and ready answers', () => {
    expect(healthResponse(true)).toEqual({
      status: 200,
      body: '{"status":"ok"}',
    });
    expect(healthResponse(false)).toEqual({
      status: 503,
      body: '{"status":"not-ready"}',
    });
  });

  it('is not ready before the listening callback and ready after it (BR4.1)', async () => {
    const app = createApp({
      dataSet,
      failureMode: false,
      logger: createLogger({ write: () => undefined }),
    });
    expect(app.isReady()).toBe(false);
    const readyAtListening: boolean[] = [];
    // Registered before listen(), so it runs before the callback that sets the flag.
    app.server.once('listening', () => readyAtListening.push(app.isReady()));
    const port = await app.listen(0, '127.0.0.1');
    try {
      expect(readyAtListening).toEqual([false]);
      expect(app.isReady()).toBe(true);
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(response.status).toBe(200);
    } finally {
      await app.close();
    }
    expect(app.isReady()).toBe(false);
  });

  it('runs the start hook only after the port is listening', async () => {
    const events: string[] = [];
    const app = createApp({
      dataSet,
      failureMode: false,
      logger: createLogger({ write: () => undefined }),
      onListening: () => events.push(`ready=${app.isReady()}`),
    });
    app.server.once('listening', () => events.push('listening'));
    await app.listen(0, '127.0.0.1');
    await app.close();
    expect(events).toEqual(['listening', 'ready=true']);
  });

  it('rejects when the port cannot be opened', async () => {
    const first = createApp({
      dataSet,
      failureMode: false,
      logger: createLogger({ write: () => undefined }),
    });
    const port = await first.listen(0, '127.0.0.1');
    const second = createApp({
      dataSet,
      failureMode: false,
      logger: createLogger({ write: () => undefined }),
    });
    try {
      await expect(second.listen(port, '127.0.0.1')).rejects.toThrow();
      expect(second.isReady()).toBe(false);
      await second.close();
    } finally {
      await first.close();
    }
  });
});

describe('failure mode', () => {
  it('fails every tool with FORCED_FAILURE while health stays ready (BR3.1)', async () => {
    const server = await startTestServer({ failureMode: true });
    try {
      const calls: Array<[string, Record<string, unknown>]> = [
        ['list_upgrade_plan', { service: behind.serviceName }],
        ['list_failed_ci_runs', { service: failed.serviceName }],
        [
          'apply_dependency_upgrade',
          { service: behind.serviceName, dependencyKey: behind.dependencyKey },
        ],
        [
          'rerun_ci_job',
          { service: failed.serviceName, runKey: failed.runKey },
        ],
      ];
      for (const [name, args] of calls) {
        const result = await call(server.client, name, args);
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toEqual({
          code: 'FORCED_FAILURE',
          message: ERROR_MESSAGES.FORCED_FAILURE,
        });
      }
      expect(server.app.data.overlay.upgradedDependencies.size).toBe(0);
      expect((await fetch(`${server.baseUrl}/healthz`)).status).toBe(200);
    } finally {
      await server.close();
    }
  });
});

describe('no file is written (NFR5.2)', () => {
  it('opens nothing for writing during a full run', async () => {
    const targets = [
      'writeFile',
      'writeFileSync',
      'appendFile',
      'appendFileSync',
      'createWriteStream',
      'openSync',
      'mkdirSync',
    ] as const;
    const spies = targets.map(name => jest.spyOn(fs, name as 'writeFileSync'));
    const server = await startTestServer();
    try {
      await call(server.client, 'list_upgrade_plan', {
        service: behind.serviceName,
      });
      await call(server.client, 'apply_dependency_upgrade', {
        service: behind.serviceName,
        dependencyKey: behind.dependencyKey,
      });
      await call(server.client, 'rerun_ci_job', {
        service: failed.serviceName,
        runKey: failed.runKey,
      });
      await fetch(`${server.baseUrl}/healthz`);
      const writes = spies.flatMap(spy => spy.mock.calls);
      expect(writes).toEqual([]);
    } finally {
      await server.close();
      spies.forEach(spy => spy.mockRestore());
    }
  });

  it('keeps the large-data factor out of the start-up path (NFR1.5)', () => {
    for (const file of ['app.ts', 'run.ts', 'main.ts']) {
      const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
      expect(source).not.toMatch(/scaled|SizeFactor|SIZE_FACTOR/i);
    }
  });
});
