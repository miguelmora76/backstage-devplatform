import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ERROR_CODES } from './errors';
import { DEFAULT_SEED, generateDataSet } from './generator';
import { TOOL_NAMES } from './tools/handlers';
import {
  checkToolResult,
  loadSpec,
  validateSchema,
  type ContractSpec,
  type Schema,
} from './testing/contractCheck';
import { startTestServer } from './testing/testServer';

const dataSet = generateDataSet(DEFAULT_SEED);
const behind = dataSet.dependencies.find(
  d => d.currentVersion !== d.recommendedVersion,
)!;
const failed = dataSet.ciRuns.find(r => r.status === 'failed')!;
const spec: ContractSpec = loadSpec();

const GOOD_CALLS: Record<string, Record<string, string>> = {
  list_upgrade_plan: { service: behind.serviceName },
  list_failed_ci_runs: { service: failed.serviceName },
  apply_dependency_upgrade: {
    service: behind.serviceName,
    dependencyKey: behind.dependencyKey,
  },
  rerun_ci_job: { service: failed.serviceName, runKey: failed.runKey },
};

async function call(
  client: Client,
  name: string,
  args?: Record<string, unknown>,
) {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

describe('contract C2: the server against the machine-readable spec', () => {
  it('lists the same four tools, kinds, timeouts and idempotence as the spec', async () => {
    const server = await startTestServer();
    try {
      const { tools } = await server.client.listTools();
      expect(spec.tools.map(t => t.name).sort()).toEqual(
        [...TOOL_NAMES].sort(),
      );
      expect(tools.map(t => t.name).sort()).toEqual(
        spec.tools.map(t => t.name).sort(),
      );
      for (const tool of spec.tools) {
        const listed = tools.find(t => t.name === tool.name)!;
        expect(Object.keys(listed.inputSchema.properties ?? {}).sort()).toEqual(
          Object.keys(tool.input.properties ?? {}).sort(),
        );
        expect(listed.annotations?.readOnlyHint).toBe(tool.kind === 'read');
      }
      const byName = Object.fromEntries(spec.tools.map(t => [t.name, t]));
      expect(byName.list_upgrade_plan).toMatchObject({
        kind: 'read',
        timeoutMs: 3000,
      });
      expect(byName.list_failed_ci_runs).toMatchObject({
        kind: 'read',
        timeoutMs: 3000,
      });
      expect(byName.apply_dependency_upgrade).toMatchObject({
        kind: 'write',
        timeoutMs: 10000,
        idempotent: true,
      });
      // The re-run tool is safe to repeat: the contract's earlier "not idempotent" is replaced.
      expect(byName.rerun_ci_job).toMatchObject({
        kind: 'write',
        timeoutMs: 10000,
        idempotent: true,
      });
    } finally {
      await server.close();
    }
  });

  it('answers every tool with an input and output that match the spec', async () => {
    const server = await startTestServer();
    try {
      for (const tool of spec.tools) {
        const args = GOOD_CALLS[tool.name];
        expect(validateSchema(tool.input, args)).toEqual([]);
        const first = await call(server.client, tool.name, args);
        expect(checkToolResult(spec, tool.name, first)).toEqual([]);
        expect(first.isError).toBeFalsy();
        const repeat = await call(server.client, tool.name, args);
        expect(checkToolResult(spec, tool.name, repeat)).toEqual([]);
      }
    } finally {
      await server.close();
    }
  });

  it('reports every listed error code in the shape the spec gives', async () => {
    const server = await startTestServer();
    const failing = await startTestServer({ failureMode: true });
    try {
      const seen = new Set<string>();
      const attempts: Array<[Client, string, Record<string, unknown>?]> = [
        [server.client, 'list_upgrade_plan', { service: 'no-such-service' }],
        [server.client, 'list_failed_ci_runs', { service: 'no-such-service' }],
        [
          server.client,
          'apply_dependency_upgrade',
          { service: behind.serviceName, dependencyKey: 'nope' },
        ],
        [
          server.client,
          'rerun_ci_job',
          { service: failed.serviceName, runKey: 'nope' },
        ],
        [server.client, 'list_upgrade_plan', {}],
        [server.client, 'rerun_ci_job', { service: failed.serviceName }],
        [failing.client, 'list_upgrade_plan', GOOD_CALLS.list_upgrade_plan],
        [failing.client, 'rerun_ci_job', GOOD_CALLS.rerun_ci_job],
      ];
      for (const [client, name, args] of attempts) {
        const result = await call(client, name, args);
        expect(result.isError).toBe(true);
        expect(checkToolResult(spec, name, result)).toEqual([]);
        seen.add((result.structuredContent as { code: string }).code);
      }
      expect([...seen].sort()).toEqual(
        [
          'FORCED_FAILURE',
          'INVALID_INPUT',
          'UNKNOWN_DEPENDENCY',
          'UNKNOWN_RUN',
          'UNKNOWN_SERVICE',
        ].sort(),
      );
    } finally {
      await server.close();
      await failing.close();
    }
  });

  it('lists the same error codes as the server and on each tool', () => {
    expect([...spec.errorCodes].sort()).toEqual([...ERROR_CODES].sort());
    for (const tool of spec.tools) {
      for (const code of [
        'INVALID_INPUT',
        'FORCED_FAILURE',
        'INTERNAL_ERROR',
      ]) {
        expect(tool.errors).toContain(code);
      }
      for (const code of tool.errors) {
        expect(spec.errorCodes).toContain(code);
      }
    }
    expect(
      spec.tools.find(t => t.name === 'list_upgrade_plan')!.errors,
    ).toContain('UNKNOWN_SERVICE');
    expect(
      spec.tools.find(t => t.name === 'apply_dependency_upgrade')!.errors,
    ).toContain('UNKNOWN_DEPENDENCY');
    expect(spec.tools.find(t => t.name === 'rerun_ci_job')!.errors).toContain(
      'UNKNOWN_RUN',
    );
    expect(spec.failureMode.setting).toBe('GUARDRAILS_FAILURE_MODE');
  });

  it('fails the same check for a deliberately wrong stand-in', () => {
    const goodPlan: CallToolResult = {
      structuredContent: {
        service: 'a-b',
        dependencies: [
          {
            dependencyKey: 'a-b/x-y',
            name: 'x-y',
            currentVersion: '1.0.0',
            recommendedVersion: '1.0.1',
          },
        ],
      },
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            service: 'a-b',
            dependencies: [
              {
                dependencyKey: 'a-b/x-y',
                name: 'x-y',
                currentVersion: '1.0.0',
                recommendedVersion: '1.0.1',
              },
            ],
          }),
        },
      ],
    };
    expect(checkToolResult(spec, 'list_upgrade_plan', goodPlan)).toEqual([]);

    const missingField: CallToolResult = {
      ...goodPlan,
      structuredContent: { service: 'a-b', dependencies: [{ name: 'x-y' }] },
    };
    expect(
      checkToolResult(spec, 'list_upgrade_plan', missingField).length,
    ).toBeGreaterThan(0);

    const wrongType: CallToolResult = {
      ...goodPlan,
      structuredContent: { service: 7, dependencies: [] },
    };
    expect(
      checkToolResult(spec, 'list_upgrade_plan', wrongType).length,
    ).toBeGreaterThan(0);

    const strangeCode: CallToolResult = {
      isError: true,
      structuredContent: { code: 'SOMETHING_ELSE', message: 'no' },
      content: [{ type: 'text', text: 'no' }],
    };
    expect(
      checkToolResult(spec, 'rerun_ci_job', strangeCode).length,
    ).toBeGreaterThan(0);

    const wrongResultValue: CallToolResult = {
      structuredContent: { runKey: 'a#1', result: 'queued' },
      content: [
        {
          type: 'text',
          text: JSON.stringify({ runKey: 'a#1', result: 'queued' }),
        },
      ],
    };
    expect(
      checkToolResult(spec, 'rerun_ci_job', wrongResultValue).length,
    ).toBeGreaterThan(0);

    const textMismatch: CallToolResult = {
      isError: true,
      structuredContent: {
        code: 'UNKNOWN_RUN',
        message: 'The CI run is not known for this service.',
      },
      content: [{ type: 'text', text: 'something else' }],
    };
    expect(
      checkToolResult(spec, 'rerun_ci_job', textMismatch).length,
    ).toBeGreaterThan(0);
    expect(
      checkToolResult(spec, 'not_a_tool', goodPlan).length,
    ).toBeGreaterThan(0);
  });

  it('validates schemas for the types the spec uses', () => {
    const schema: Schema = {
      type: 'object',
      required: ['a'],
      properties: {
        a: { type: 'integer' },
        b: { type: 'array', items: { type: 'string' } },
        c: { type: 'string', enum: ['x', 'y'] },
      },
    };
    expect(validateSchema(schema, { a: 1, b: ['q'], c: 'x' })).toEqual([]);
    expect(validateSchema(schema, { a: 1.5 }).length).toBe(1);
    expect(validateSchema(schema, {}).length).toBe(1);
    expect(validateSchema(schema, { a: 1, b: [1] }).length).toBe(1);
    expect(validateSchema(schema, { a: 1, c: 'z' }).length).toBe(1);
    expect(validateSchema(schema, 'text').length).toBe(1);
    expect(validateSchema({ type: 'string' }, 'ok')).toEqual([]);
  });
});
