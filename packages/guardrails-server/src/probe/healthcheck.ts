import * as http from 'node:http';

type Env = Readonly<Record<string, string | undefined>>;

const TIMEOUT_MS = 2000;

/**
 * The container health probe: a small Node.js script (the image has no curl)
 * that reads the PORT setting and requests the health route. Exit code 0
 * means ready; anything else means not ready.
 */
export function healthExitCode(env: Env, host = '127.0.0.1'): Promise<0 | 1> {
  const port = Number(env.PORT);
  if (!/^\d+$/.test(env.PORT ?? '') || port < 1 || port > 65535) {
    return Promise.resolve(1);
  }
  return new Promise(resolve => {
    const request = http.get(
      { host, port, path: '/healthz', timeout: TIMEOUT_MS },
      response => {
        response.resume();
        resolve(response.statusCode === 200 ? 0 : 1);
      },
    );
    request.on('timeout', () => {
      request.destroy();
      resolve(1);
    });
    request.on('error', () => resolve(1));
  });
}

if (require.main === module) {
  void healthExitCode(process.env).then(code => process.exit(code));
}
