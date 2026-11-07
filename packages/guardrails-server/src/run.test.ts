import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DEFAULT_SEED, generateDataSet } from './generator';
import { createLogger } from './logger';
import { run, type RunResult } from './run';
import { freePort } from './testing/freePort';

const HOST = '127.0.0.1';

async function startRun(env: Record<string, string | undefined>) {
  const lines: string[] = [];
  const stops: string[] = [];
  const result: RunResult = await run({
    env,
    host: HOST,
    logger: createLogger({ write: line => lines.push(line) }),
    writeLine: line => stops.push(line),
  });
  return { result, lines, stops };
}

async function connect(port: number): Promise<Client> {
  const client = new Client({ name: 'run-test', version: '0.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`http://${HOST}:${port}/mcp`)),
  );
  return client;
}

describe('run', () => {
  it.each([
    [
      { GUARDRAILS_SEED: 'abc', PORT: '7007' },
      'Invalid GUARDRAILS_SEED: expected a whole number.',
    ],
    [
      { GUARDRAILS_FAILURE_MODE: 'maybe', PORT: '7007' },
      'Invalid GUARDRAILS_FAILURE_MODE: expected on or off.',
    ],
    [{}, 'Invalid PORT: expected a whole number from 1 to 65535.'],
  ])(
    'stops with one sentence and exit code 1 for invalid settings (BR3.2)',
    async (env, sentence) => {
      const { result, lines, stops } = await startRun(env);
      expect(result).toEqual({ exitCode: 1 });
      expect(stops).toEqual([sentence]);
      expect(lines).toEqual([]);
    },
  );

  it('starts, becomes ready within 10 seconds and logs the start line (NFR1.2, NFR7.7)', async () => {
    const port = await freePort();
    const began = Date.now();
    const { result, lines, stops } = await startRun({
      PORT: String(port),
      GUARDRAILS_SEED: '31',
    });
    expect(result.exitCode).toBe(0);
    if (result.exitCode !== 0) {
      throw new Error('server did not start');
    }
    try {
      const health = await fetch(`http://${HOST}:${port}/healthz`);
      expect(health.status).toBe(200);
      expect(Date.now() - began).toBeLessThan(10000);
      expect(stops).toEqual([]);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(
        new RegExp(`Z start seed=31 failure=off port=${port}$`),
      );
    } finally {
      await result.app.close();
    }
  });

  it('serves the data of the configured seed and the default seed when none is given', async () => {
    const seeded = generateDataSet(31);
    const port = await freePort();
    const { result } = await startRun({
      PORT: String(port),
      GUARDRAILS_SEED: '31',
    });
    if (result.exitCode !== 0) {
      throw new Error('server did not start');
    }
    const client = await connect(port);
    try {
      const reply = (await client.callTool({
        name: 'list_upgrade_plan',
        arguments: { service: seeded.services[0].serviceName },
      })) as CallToolResult;
      expect(reply.isError).toBeFalsy();
      expect(
        (reply.structuredContent as { dependencies: unknown[] }).dependencies,
      ).toHaveLength(
        seeded.dependencies.filter(
          d => d.serviceName === seeded.services[0].serviceName,
        ).length,
      );
    } finally {
      await client.close();
      await result.app.close();
    }

    const defaultPort = await freePort();
    const { result: second, lines } = await startRun({
      PORT: String(defaultPort),
    });
    if (second.exitCode !== 0) {
      throw new Error('server did not start');
    }
    try {
      expect(lines[0]).toContain(`start seed=${DEFAULT_SEED} failure=off`);
    } finally {
      await second.app.close();
    }
  });

  it('fails every tool when the failure mode is on', async () => {
    const port = await freePort();
    const { result, lines } = await startRun({
      PORT: String(port),
      GUARDRAILS_FAILURE_MODE: 'on',
    });
    if (result.exitCode !== 0) {
      throw new Error('server did not start');
    }
    const client = await connect(port);
    try {
      const service = generateDataSet(DEFAULT_SEED).services[0].serviceName;
      const reply = (await client.callTool({
        name: 'list_upgrade_plan',
        arguments: { service },
      })) as CallToolResult;
      expect(reply.structuredContent).toMatchObject({ code: 'FORCED_FAILURE' });
      expect(lines[0]).toContain('failure=on');
    } finally {
      await client.close();
      await result.app.close();
    }
  });

  it('gives the seeded state again after a restart (NFR7.3)', async () => {
    const dataSet = generateDataSet(DEFAULT_SEED);
    const dependency = dataSet.dependencies.find(
      d => d.currentVersion !== d.recommendedVersion,
    )!;
    const plan = async (port: number) => {
      const client = await connect(port);
      try {
        const reply = (await client.callTool({
          name: 'list_upgrade_plan',
          arguments: { service: dependency.serviceName },
        })) as CallToolResult;
        const items = (
          reply.structuredContent as {
            dependencies: Array<{
              dependencyKey: string;
              currentVersion: string;
            }>;
          }
        ).dependencies;
        return items.find(d => d.dependencyKey === dependency.dependencyKey)!
          .currentVersion;
      } finally {
        await client.close();
      }
    };

    const firstPort = await freePort();
    const first = await startRun({ PORT: String(firstPort) });
    if (first.result.exitCode !== 0) {
      throw new Error('server did not start');
    }
    const client = await connect(firstPort);
    await client.callTool({
      name: 'apply_dependency_upgrade',
      arguments: {
        service: dependency.serviceName,
        dependencyKey: dependency.dependencyKey,
      },
    });
    await client.close();
    expect(await plan(firstPort)).toBe(dependency.recommendedVersion);
    await first.result.app.close();

    const secondPort = await freePort();
    const second = await startRun({ PORT: String(secondPort) });
    if (second.result.exitCode !== 0) {
      throw new Error('server did not start');
    }
    try {
      expect(await plan(secondPort)).toBe(dependency.currentVersion);
    } finally {
      await second.result.app.close();
    }
  });

  it('stops with one sentence when the port cannot be opened', async () => {
    const port = await freePort();
    const first = await startRun({ PORT: String(port) });
    if (first.result.exitCode !== 0) {
      throw new Error('server did not start');
    }
    try {
      const second = await startRun({ PORT: String(port) });
      expect(second.result).toEqual({ exitCode: 1 });
      expect(second.stops).toEqual([
        'Could not listen on the configured port.',
      ]);
      expect(second.lines).toEqual([]);
    } finally {
      await first.result.app.close();
    }
  });
});
