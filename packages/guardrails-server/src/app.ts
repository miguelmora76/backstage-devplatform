import * as http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { SeedDataSet } from './generator';
import type { Logger } from './logger';
import { GuardrailsData } from './store';
import { createToolHandlers } from './tools/handlers';
import { registerTools } from './tools/register';

export const SERVER_INFO = { name: 'guardrails-server', version: '0.1.0' };

export interface AppOptions {
  /** A ready data set: start-up passes the default-size set, tests may pass a larger one. */
  dataSet: SeedDataSet;
  failureMode: boolean;
  logger: Logger;
  /** Runs inside the listening callback, right after the ready flag is set. */
  onListening?: () => void;
}

export interface App {
  server: http.Server;
  data: GuardrailsData;
  isReady(): boolean;
  /** Opens the port and resolves with the port in use once it is listening. */
  listen(port: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

export function healthResponse(ready: boolean): {
  status: number;
  body: string;
} {
  return ready
    ? { status: 200, body: '{"status":"ok"}' }
    : { status: 503, body: '{"status":"not-ready"}' };
}

const JSON_HEADERS = { 'content-type': 'application/json' };

function sendFixed(
  res: http.ServerResponse,
  status: number,
  body: string,
  extra: Record<string, string> = {},
): void {
  res.writeHead(status, { ...JSON_HEADERS, ...extra });
  res.end(body);
}

const NOT_FOUND = '{"error":"not found"}';
const METHOD_NOT_ALLOWED = '{"error":"method not allowed"}';
const INTERNAL =
  '{"jsonrpc":"2.0","error":{"code":-32603,"message":"Internal server error"},"id":null}';

/**
 * The HTTP shell: the MCP route (/mcp, POST) and the health route (/healthz,
 * GET). Every other path or method gets a fixed body that echoes nothing from
 * the request (NFR5.1). The server is built by this factory from a ready data
 * set; the ready flag is set only inside the listening callback (BR4.1).
 */
export function createApp(options: AppOptions): App {
  const data = new GuardrailsData(options.dataSet);
  const handlers = createToolHandlers({
    data,
    failureMode: options.failureMode,
    logger: options.logger,
  });
  let ready = false;

  // Stateless streamable HTTP: a fresh protocol server per request, sharing
  // the one data layer. Responses are plain JSON, no event stream.
  const handleMcp = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> => {
    const mcp = new McpServer(SERVER_INFO);
    registerTools(mcp, handlers);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void mcp.close();
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res);
  };

  const server = http.createServer((req, res) => {
    const route = (req.url ?? '').split('?')[0];
    if (route === '/healthz') {
      if (req.method !== 'GET') {
        sendFixed(res, 405, METHOD_NOT_ALLOWED, { allow: 'GET' });
        return;
      }
      const { status, body } = healthResponse(ready);
      sendFixed(res, status, body);
      return;
    }
    if (route === '/mcp') {
      if (req.method !== 'POST') {
        sendFixed(res, 405, METHOD_NOT_ALLOWED, { allow: 'POST' });
        return;
      }
      handleMcp(req, res).catch(() => {
        if (!res.headersSent) {
          sendFixed(res, 500, INTERNAL);
        } else {
          res.end();
        }
      });
      return;
    }
    sendFixed(res, 404, NOT_FOUND);
  });

  return {
    server,
    data,
    isReady: () => ready,
    listen(port, host) {
      return new Promise<number>((resolve, reject) => {
        server.once('error', reject);
        const onListening = () => {
          server.off('error', reject);
          ready = true;
          options.onListening?.();
          const address = server.address();
          resolve(typeof address === 'object' && address ? address.port : port);
        };
        if (host === undefined) {
          server.listen(port, onListening);
        } else {
          server.listen(port, host, onListening);
        }
      });
    },
    close() {
      ready = false;
      return new Promise<void>(resolve => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close(() => resolve());
        server.closeAllConnections();
      });
    },
  };
}
