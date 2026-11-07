import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DEFAULT_SEED, generateDataSet } from './generator';
import { generateScaledDataSet } from './generator/scaled';
import { createLogger } from './logger';
import { GuardrailsData } from './store';
import { startTestServer } from './testing/testServer';
import {
  createToolHandlers,
  TOOL_NAMES,
  type ToolName,
} from './tools/handlers';

const dataSet = generateDataSet(DEFAULT_SEED);
const behind = dataSet.dependencies.find(
  d => d.currentVersion !== d.recommendedVersion,
)!;
const failed = dataSet.ciRuns.find(r => r.status === 'failed')!;

const ARGS: Record<ToolName, Record<string, string>> = {
  list_upgrade_plan: { service: behind.serviceName },
  list_failed_ci_runs: { service: failed.serviceName },
  apply_dependency_upgrade: {
    service: behind.serviceName,
    dependencyKey: behind.dependencyKey,
  },
  rerun_ci_job: { service: failed.serviceName, runKey: failed.runKey },
};

const CALLS = 200;
const TARGET_MS = 200;

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

function elapsedMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

async function callAll(client: Client, name: ToolName) {
  return (await client.callTool({
    name,
    arguments: ARGS[name],
  })) as CallToolResult;
}

describe('performance (NFR1.1)', () => {
  it('meets 200 ms at the 95th percentile over 200 calls per tool, in the handlers', () => {
    const handlers = createToolHandlers({
      data: new GuardrailsData(dataSet),
      failureMode: false,
      logger: createLogger({ write: () => undefined }),
    });
    for (const name of TOOL_NAMES) {
      const times: number[] = [];
      for (let i = 0; i < CALLS; i++) {
        const start = process.hrtime.bigint();
        const result = handlers[name](ARGS[name]);
        times.push(elapsedMs(start));
        expect(result.isError).toBeFalsy();
      }
      const value = p95(times);
      console.info(
        `BENCHMARK handlers tool=${name} calls=${CALLS} p95_ms=${value.toFixed(3)}`,
      );
      expect(value).toBeLessThanOrEqual(TARGET_MS);
    }
  });

  it('meets 200 ms at the 95th percentile over 200 calls per tool, through the HTTP route', async () => {
    const server = await startTestServer();
    try {
      for (const name of TOOL_NAMES) {
        const times: number[] = [];
        for (let i = 0; i < CALLS; i++) {
          const start = process.hrtime.bigint();
          const result = await callAll(server.client, name);
          times.push(elapsedMs(start));
          expect(result.isError).toBeFalsy();
        }
        const value = p95(times);
        console.info(
          `BENCHMARK http tool=${name} calls=${CALLS} p95_ms=${value.toFixed(3)}`,
        );
        expect(value).toBeLessThanOrEqual(TARGET_MS);
      }
      const heapMb = process.memoryUsage().heapUsed / (1024 * 1024);
      console.info(`BENCHMARK heap_used_mb=${heapMb.toFixed(1)}`);
      expect(heapMb).toBeLessThan(256);
    } finally {
      await server.close();
    }
  });
});

describe('concurrency and scale', () => {
  it('serves 10 simultaneous calls and identical writes leave one change (NFR1.4)', async () => {
    const server = await startTestServer();
    try {
      const names: ToolName[] = [
        'list_upgrade_plan',
        'list_failed_ci_runs',
        'apply_dependency_upgrade',
        'apply_dependency_upgrade',
        'rerun_ci_job',
        'rerun_ci_job',
        'list_upgrade_plan',
        'list_failed_ci_runs',
        'list_upgrade_plan',
        'list_failed_ci_runs',
      ];
      const start = process.hrtime.bigint();
      const results = await Promise.all(
        names.map(async name => {
          const begun = process.hrtime.bigint();
          const result = await callAll(server.client, name);
          return { name, result, ms: elapsedMs(begun) };
        }),
      );
      expect(elapsedMs(start)).toBeLessThan(5000);
      for (const { result } of results) {
        expect(result.isError).toBeFalsy();
      }
      expect(p95(results.map(r => r.ms))).toBeLessThanOrEqual(TARGET_MS);
      const applies = results
        .filter(r => r.name === 'apply_dependency_upgrade')
        .map(r => (r.result.structuredContent as { result: string }).result)
        .sort();
      expect(applies).toEqual(['already-current', 'applied']);
      const reruns = results
        .filter(r => r.name === 'rerun_ci_job')
        .map(r => r.result.structuredContent);
      expect(reruns[0]).toEqual(reruns[1]);
      expect(server.app.data.overlay.upgradedDependencies.size).toBe(1);
      expect(server.app.data.overlay.rerunRuns.size).toBe(1);
    } finally {
      await server.close();
    }
  });

  it('loads a data set ten times the default size through the factory (NFR1.5)', async () => {
    const large = generateScaledDataSet(DEFAULT_SEED, 10);
    const server = await startTestServer({ dataSet: large });
    try {
      const service = large.dependencies[0].serviceName;
      const times: number[] = [];
      for (let i = 0; i < 50; i++) {
        const start = process.hrtime.bigint();
        const result = await server.client.callTool({
          name: 'list_upgrade_plan',
          arguments: { service },
        });
        times.push(elapsedMs(start));
        expect((result as CallToolResult).isError).toBeFalsy();
      }
      const plan = (await server.client.callTool({
        name: 'list_upgrade_plan',
        arguments: { service },
      })) as CallToolResult;
      expect(
        (plan.structuredContent as { dependencies: unknown[] }).dependencies,
      ).toHaveLength(
        large.dependencies.filter(d => d.serviceName === service).length,
      );
      expect(p95(times)).toBeLessThanOrEqual(TARGET_MS);
    } finally {
      await server.close();
    }
  });
});
