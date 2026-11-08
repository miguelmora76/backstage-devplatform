import * as fs from 'node:fs';
import { resolvePackagePath } from '@backstage/backend-plugin-api';
import { mockCredentials, mockServices } from '@backstage/backend-test-utils';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parse } from 'yaml';
import { ERROR_CODES } from '../errors';
import { createRouter } from '../http/router';
import { REASONS } from '../rules/allowedActions';
import {
  createGuardrailsClient,
  KNOWN_SERVER_CODES,
} from '../server/guardrailsClient';
import { createCapturingLogger } from '../testing/harness';
import { createFakeClock } from '../testing/fakeClock';
import {
  loadC2Spec,
  startStandIn,
  type StandIn,
} from '../testing/standInServer';

/**
 * The contract check (pipeline stage 7, NFR2.5): the stand-in server and the
 * client are compared with the C2 spec kept by u1, and the route list and the
 * code lists are compared with the C1 interface file kept by this unit.
 */
const C1_PATH = resolvePackagePath(
  'plugin-guardrails-backend',
  'contract',
  'c1-openapi.yaml',
);

interface OpenApi {
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<
      string,
      { properties?: Record<string, { enum?: string[] }> }
    >;
  };
}

function loadC1(): OpenApi {
  return parse(fs.readFileSync(C1_PATH, 'utf8')) as OpenApi;
}

describe('contract C2: the stand-in server and the client against the spec', () => {
  const spec = loadC2Spec();
  let standIn: StandIn;

  beforeEach(async () => {
    standIn = await startStandIn();
  });

  afterEach(async () => {
    await standIn.close();
  });

  it('lists exactly the tools of the spec with their input schemas', async () => {
    const client = new Client({ name: 'contract-check', version: '0.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${standIn.url}/mcp`)),
    );
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.map(t => t.name).sort()).toEqual(
      spec.tools.map(t => t.name).sort(),
    );
    for (const tool of spec.tools) {
      const listed = tools.find(t => t.name === tool.name);
      expect(listed?.inputSchema.required).toEqual(tool.input.required);
      expect(Object.keys(listed?.inputSchema.properties ?? {}).sort()).toEqual(
        Object.keys(tool.input.properties).sort(),
      );
    }
  });

  it('calls only tools of the spec, with arguments that meet their input schema, and uses all four', async () => {
    const client = createGuardrailsClient({
      url: standIn.url,
      readTimeoutMs: 3000,
      writeTimeoutMs: 3000,
    });
    await client.listUpgradePlan('orders');
    await client.listFailedCiRuns('orders');
    await client.applyDependencyUpgrade('orders', 'dep-1');
    await client.rerunCiJob('orders', 'run-1');
    await client.close();

    const used = new Set<string>();
    for (const call of standIn.calls) {
      const tool = spec.tools.find(t => t.name === call.tool);
      expect(tool).toBeDefined();
      used.add(call.tool);
      for (const required of tool?.input.required ?? []) {
        expect(typeof call.args[required]).toBe('string');
      }
      expect(Object.keys(call.args).sort()).toEqual(
        Object.keys(tool?.input.properties ?? {}).sort(),
      );
    }
    expect([...used].sort()).toEqual(spec.tools.map(t => t.name).sort());
  });

  it('knows every error code of the spec and the stand-in answers each one the client reads', async () => {
    expect([...KNOWN_SERVER_CODES].sort()).toEqual([...spec.errorCodes].sort());
    const client = createGuardrailsClient({
      url: standIn.url,
      readTimeoutMs: 3000,
      writeTimeoutMs: 3000,
    });
    const run: Record<string, () => Promise<unknown>> = {
      list_upgrade_plan: () => client.listUpgradePlan('orders'),
      list_failed_ci_runs: () => client.listFailedCiRuns('orders'),
      apply_dependency_upgrade: () =>
        client.applyDependencyUpgrade('orders', 'dep-1'),
      rerun_ci_job: () => client.rerunCiJob('orders', 'run-1'),
    };
    for (const tool of spec.tools) {
      for (const code of tool.errors) {
        standIn.setToolError(tool.name, code);
        await expect(run[tool.name]()).rejects.toMatchObject({ code });
      }
      standIn.setToolError(tool.name, undefined);
    }
    await client.close();
  });
});

describe('contract C1: the route list and the code lists against the interface file', () => {
  const c1 = loadC1();

  function registeredRoutes(): string[] {
    const router = createRouter({
      httpAuth: mockServices.httpAuth({
        defaultCredentials: mockCredentials.none(),
      }),
      workflow: {} as never,
      logger: createCapturingLogger(),
      clock: createFakeClock(),
      demoSignInEnabled: true,
    });
    const routes: string[] = [];
    for (const layer of (
      router as unknown as {
        stack: Array<{
          route?: { path: string; methods: Record<string, boolean> };
        }>;
      }
    ).stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          routes.push(`${method.toUpperCase()} ${layer.route.path}`);
        }
      }
    }
    return routes.sort();
  }

  function documentedRoutes(): string[] {
    const routes: string[] = [];
    for (const [path, operations] of Object.entries(c1.paths)) {
      for (const method of Object.keys(operations)) {
        routes.push(
          `${method.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ':$1')}`,
        );
      }
    }
    return routes.sort();
  }

  it('serves exactly the routes the interface file documents', () => {
    expect(registeredRoutes()).toEqual(documentedRoutes());
  });

  it('lists every allowed-action reason the rules can give', () => {
    const documented =
      c1.components.schemas.AllowedAction.properties?.reason.enum ?? [];
    expect([...documented].sort()).toEqual([...REASONS].sort());
  });

  it('lists every error code the API can answer with', () => {
    const documented = c1.components.schemas.Error.properties
      ?.error as unknown as {
      properties: { code: { enum: string[] } };
    };
    expect([...documented.properties.code.enum].sort()).toEqual(
      [...ERROR_CODES, 'INTERNAL_ERROR'].sort(),
    );
  });
});
