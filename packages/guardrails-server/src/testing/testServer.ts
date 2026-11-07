import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp, type App } from '../app';
import { DEFAULT_SEED, generateDataSet, type SeedDataSet } from '../generator';
import { createLogger } from '../logger';

export interface TestServer {
  app: App;
  port: number;
  baseUrl: string;
  client: Client;
  lines: string[];
  close(): Promise<void>;
}

export interface TestServerOptions {
  dataSet?: SeedDataSet;
  failureMode?: boolean;
}

/** Starts the real server on a free port and connects the MCP kit's client to it. */
export async function startTestServer(
  options: TestServerOptions = {},
): Promise<TestServer> {
  const lines: string[] = [];
  const app = createApp({
    dataSet: options.dataSet ?? generateDataSet(DEFAULT_SEED),
    failureMode: options.failureMode ?? false,
    logger: createLogger({ write: line => lines.push(line) }),
  });
  const port = await app.listen(0, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${port}`;
  const client = new Client({
    name: 'guardrails-test-client',
    version: '0.0.0',
  });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)),
  );
  return {
    app,
    port,
    baseUrl,
    client,
    lines,
    async close() {
      await client.close();
      await app.close();
    },
  };
}
