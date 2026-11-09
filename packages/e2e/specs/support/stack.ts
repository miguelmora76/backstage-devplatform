import { spawnSync } from 'node:child_process';
import { composeArgs } from '../../src/composeArgs';

// Control of single containers of the running sample, for the one flow that
// needs the guardrails server to be down (a failed change that is retried).
// Every call is built by composeArgs, so it reads .env.compose only.
const root = process.cwd().replace(/\/packages\/e2e$/, '');

function docker(extra: string[]) {
  const result = spawnSync('docker', composeArgs(extra), {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`docker ${extra.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout;
}

/** The id of the service's container, read before it is ended. */
export function containerId(service: string): string {
  const id = docker(['ps', '--quiet', service]).trim();
  if (!id) throw new Error(`No running container for ${service}`);
  return id;
}

/**
 * Ends a container at once (SIGKILL) by its id: one quick docker call, not a
 * stop with a grace period and not a compose call, so the time between the
 * last health probe of the plugin backend and the end of the server stays far
 * below the 5 seconds the plugin reuses a probe result for.
 */
export function killContainer(id: string): void {
  const result = spawnSync('docker', ['kill', id], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`docker kill failed: ${result.stderr}`);
  }
}

export async function startService(service: string): Promise<void> {
  docker(['start', service]);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const out = docker(['ps', '--format', 'json', service]).trim();
    const rows = out.startsWith('[')
      ? JSON.parse(out)
      : out
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line));
    if (rows.some((row: { Health?: string }) => row.Health === 'healthy')) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`${service} did not become healthy within 60 seconds`);
}
