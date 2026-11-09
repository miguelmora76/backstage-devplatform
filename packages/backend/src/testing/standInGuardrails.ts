import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface StandInGuardrails {
  url: string;
  close(): Promise<void>;
}

/**
 * A stand-in guardrails server: answers the health route and nothing else.
 * Start-up needs no call to the real server (reliability design R3), so this is
 * enough to prove the app starts, and a closed one proves it stays up without it.
 */
export async function startStandInGuardrails(): Promise<StandInGuardrails> {
  const server: Server = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"status":"ok"}');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
