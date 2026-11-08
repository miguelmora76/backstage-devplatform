import * as fs from 'node:fs';
import * as http from 'node:http';
import { resolvePackagePath } from '@backstage/backend-plugin-api';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/** One tool of the C2 spec file kept by u1 (c2-tools.json). */
export interface C2Tool {
  name: string;
  kind: 'read' | 'write';
  timeoutMs: number;
  input: {
    type: 'object';
    required: string[];
    properties: Record<string, { type: string }>;
  };
  output: Record<string, unknown>;
  errors: string[];
}

export interface C2Spec {
  contract: string;
  endpoint: string;
  errorCodes: string[];
  tools: C2Tool[];
}

/** The machine-readable C2 spec kept by u1-data-and-server. */
export const C2_SPEC_PATH = resolvePackagePath(
  'guardrails-server',
  'contract',
  'c2-tools.json',
);

export function loadC2Spec(): C2Spec {
  return JSON.parse(fs.readFileSync(C2_SPEC_PATH, 'utf8')) as C2Spec;
}

interface Dependency {
  dependencyKey: string;
  name: string;
  currentVersion: string;
  recommendedVersion: string;
}
interface Run {
  runKey: string;
  runNumber: number;
  status: string;
  cause: string;
}

export interface StandIn {
  url: string;
  /** Every tool call the server received, in order. */
  calls: Array<{ tool: string; args: Record<string, unknown> }>;
  healthCalls: number;
  /** Delay in ms applied before any tool answers. */
  setToolDelay(ms: number): void;
  /** With it on, every tool returns FORCED_FAILURE (the health route still answers). */
  setFailureMode(on: boolean): void;
  /** Makes one tool answer with the given error code (or a normal answer when undefined). */
  setToolError(tool: string, code: string | undefined): void;
  /** Makes the health route answer 503. */
  setHealthy(healthy: boolean): void;
  /** Delay in ms applied before the health route answers. */
  setHealthDelay(ms: number): void;
  close(): Promise<void>;
}

const NOT_FOUND = '{"error":"not found"}';

function freshData(): {
  deps: Record<string, Dependency[]>;
  runs: Record<string, Run[]>;
} {
  return {
    deps: {
      orders: [
        {
          dependencyKey: 'dep-1',
          name: 'lodash',
          currentVersion: '4.0.0',
          recommendedVersion: '4.17.21',
        },
        {
          dependencyKey: 'dep-2',
          name: 'express',
          currentVersion: '4.19.2',
          recommendedVersion: '4.19.2',
        },
      ],
      billing: [],
    },
    runs: {
      orders: [
        {
          runKey: 'run-1',
          runNumber: 12,
          status: 'failed',
          cause: 'Test timeout in checkout suite',
        },
        {
          runKey: 'run-2',
          runNumber: 13,
          status: 'passed',
          cause: 'None',
        },
      ],
      billing: [],
    },
  };
}

/**
 * A stand-in for the guardrails server built from the C2 spec file: the tool
 * list, input schemas and error codes come from the spec, the data is small
 * and invented. The plugin never reads seeded data directly (FR6.2).
 */
export async function startStandIn(): Promise<StandIn> {
  const spec = loadC2Spec();
  const data = freshData();
  const calls: StandIn['calls'] = [];
  const toolErrors = new Map<string, string>();
  let delay = 0;
  let healthDelay = 0;
  let failureMode = false;
  let healthy = true;
  const state = { healthCalls: 0 };

  const wait = (ms: number) =>
    new Promise<void>(resolve => setTimeout(resolve, ms));

  const toolError = (code: string) => ({
    isError: true,
    content: [{ type: 'text' as const, text: `Stand-in error ${code}` }],
    structuredContent: { code, message: `Stand-in error ${code}` },
  });
  const ok = (value: Record<string, unknown>) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    structuredContent: value,
  });

  async function callTool(name: string, args: Record<string, unknown>) {
    calls.push({ tool: name, args });
    if (delay > 0) await wait(delay);
    const tool = spec.tools.find(t => t.name === name);
    if (!tool) return toolError('INTERNAL_ERROR');
    if (failureMode) return toolError('FORCED_FAILURE');
    const forced = toolErrors.get(name);
    if (forced) return toolError(forced);
    for (const key of tool.input.required) {
      if (typeof args[key] !== 'string' || args[key] === '') {
        return toolError('INVALID_INPUT');
      }
    }
    const service = args.service as string;
    if (!(service in data.deps)) return toolError('UNKNOWN_SERVICE');
    switch (name) {
      case 'list_upgrade_plan':
        return ok({ service, dependencies: data.deps[service] });
      case 'list_failed_ci_runs':
        return ok({
          service,
          runs: data.runs[service].filter(r => r.status === 'failed'),
        });
      case 'apply_dependency_upgrade': {
        const dep = data.deps[service].find(
          d => d.dependencyKey === args.dependencyKey,
        );
        if (!dep) return toolError('UNKNOWN_DEPENDENCY');
        const already = dep.currentVersion === dep.recommendedVersion;
        dep.currentVersion = dep.recommendedVersion;
        return ok({
          dependencyKey: dep.dependencyKey,
          currentVersion: dep.currentVersion,
          result: already ? 'already-current' : 'applied',
        });
      }
      case 'rerun_ci_job': {
        const run = data.runs[service].find(r => r.runKey === args.runKey);
        if (!run) return toolError('UNKNOWN_RUN');
        return ok({ runKey: run.runKey, result: 'rerun-started' });
      }
      default:
        return toolError('INTERNAL_ERROR');
    }
  }

  const server = http.createServer((req, res) => {
    const route = (req.url ?? '').split('?')[0];
    if (route === '/healthz' && req.method === 'GET') {
      state.healthCalls += 1;
      void wait(healthDelay).then(() => {
        res.writeHead(healthy ? 200 : 503, {
          'content-type': 'application/json',
        });
        res.end(healthy ? '{"status":"ok"}' : '{"status":"not-ready"}');
      });
      return;
    }
    if (route === spec.endpoint && req.method === 'POST') {
      const mcp = new Server(
        { name: 'stand-in-guardrails-server', version: '0.0.0' },
        { capabilities: { tools: {} } },
      );
      mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: spec.tools.map(t => ({
          name: t.name,
          description: t.name,
          inputSchema: t.input,
        })),
      }));
      mcp.setRequestHandler(CallToolRequestSchema, async request =>
        callTool(request.params.name, request.params.arguments ?? {}),
      );
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', () => {
        void transport.close();
        void mcp.close();
      });
      mcp
        .connect(transport)
        .then(() => transport.handleRequest(req, res))
        .catch(() => {
          if (!res.headersSent) res.writeHead(500);
          res.end();
        });
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(NOT_FOUND);
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;

  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    get healthCalls() {
      return state.healthCalls;
    },
    setToolDelay: ms => {
      delay = ms;
    },
    setFailureMode: on => {
      failureMode = on;
    },
    setToolError: (tool, code) => {
      if (code) toolErrors.set(tool, code);
      else toolErrors.delete(tool);
    },
    setHealthy: value => {
      healthy = value;
    },
    setHealthDelay: ms => {
      healthDelay = ms;
    },
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
