import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { generateDataSet } from '../generator';
import { readSettings } from '../settings';

type Env = Readonly<Record<string, string | undefined>>;

export interface SmokeResult {
  ok: boolean;
  message: string;
}

/**
 * The container smoke call: asks the running server for the upgrade plan of
 * the first seeded service that has dependencies and checks the answer holds
 * every seeded dependency. It uses the same settings as the server, so it
 * runs inside the container, where no port is published.
 */
export async function runSmoke(
  env: Env,
  host = '127.0.0.1',
): Promise<SmokeResult> {
  const read = readSettings(env);
  if (!read.ok) {
    return { ok: false, message: read.message };
  }
  const dataSet = generateDataSet(read.settings.seed);
  const service = dataSet.dependencies[0].serviceName;
  const expected = dataSet.dependencies.filter(
    d => d.serviceName === service,
  ).length;

  const client = new Client({ name: 'guardrails-smoke', version: '0.1.0' });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`http://${host}:${read.settings.port}/mcp`),
      ),
    );
    const reply = await client.callTool({
      name: 'list_upgrade_plan',
      arguments: { service },
    });
    const content = reply.structuredContent as
      { code?: string; dependencies?: unknown[] } | undefined;
    if (reply.isError) {
      return {
        ok: false,
        message: `smoke failed: list_upgrade_plan returned ${content?.code ?? 'an error'}`,
      };
    }
    if (content?.dependencies?.length !== expected) {
      return {
        ok: false,
        message: 'smoke failed: the plan does not match the seeded data',
      };
    }
    return {
      ok: true,
      message: `smoke ok: list_upgrade_plan ${service} returned ${expected} dependencies`,
    };
  } catch {
    return { ok: false, message: 'smoke failed: the server did not answer' };
  } finally {
    await client.close().catch(() => undefined);
  }
}

if (require.main === module) {
  void runSmoke(process.env).then(result => {
    process.stdout.write(`${result.message}\n`);
    process.exit(result.ok ? 0 : 1);
  });
}
