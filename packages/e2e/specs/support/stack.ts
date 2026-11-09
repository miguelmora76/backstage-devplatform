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

export function stopService(service: string): void {
  docker(['stop', '--timeout', '5', service]);
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
