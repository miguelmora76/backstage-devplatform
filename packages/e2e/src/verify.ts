import { runCompose } from './composeArgs';
import { Runner } from './runner';

interface Publisher {
  URL?: string;
  PublishedPort?: number;
}
interface PsRow {
  Service?: string;
  Publishers?: Publisher[];
}

function parsePs(output: string): PsRow[] {
  const text = output.trim();
  if (text.startsWith('[')) return JSON.parse(text);
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

/**
 * Reads `docker compose ps --format json` of the running sample and finds
 * only one published host port, bound to 127.0.0.1 (NFR5.1).
 */
export function checkPublishedPorts(psOutput: string): string[] {
  let rows: PsRow[];
  try {
    rows = parsePs(psOutput);
  } catch {
    return ['NFR5.1: could not read the compose ps output.'];
  }
  const published = rows.flatMap(row =>
    (row.Publishers ?? [])
      .filter(p => (p.PublishedPort ?? 0) > 0)
      .map(p => ({ service: row.Service ?? '?', url: p.URL ?? '' })),
  );
  const problems: string[] = [];
  if (published.length !== 1) {
    problems.push(
      `NFR5.1: the running sample must publish exactly one host port, found ${published.length}.`,
    );
  }
  for (const p of published) {
    if (p.url !== '127.0.0.1') {
      problems.push(
        `NFR5.1: ${p.service} publishes on ${p.url || 'an unknown address'}, not 127.0.0.1.`,
      );
    }
  }
  return problems;
}

export const MISSING_ADDRESS_CONTAINER = 'guardrails-missing-address';

export interface MissingAddressResult {
  exitCode: number | null;
  output: string;
  healthStatus: string | undefined;
  timedOut: boolean;
}

/** The pass conditions of NFR5.12. */
export function evaluateMissingAddress(r: MissingAddressResult): string[] {
  const problems: string[] = [];
  if (r.timedOut) {
    problems.push('NFR5.12: the container did not exit within 60 seconds.');
  } else if (r.exitCode === null || r.exitCode === 0) {
    problems.push('NFR5.12: the container must exit with a non-zero code.');
  }
  if (!r.output.includes('guardrails.server.url')) {
    problems.push('NFR5.12: the output must name guardrails.server.url.');
  }
  if (r.healthStatus === 'healthy') {
    problems.push('NFR5.12: the container must never have been healthy.');
  }
  return problems;
}

/**
 * Starts a second app container on the compose network with the server
 * address emptied, without --rm and under a fixed name, inspects it, then
 * removes it also on failure (NFR5.12, NFR7.2).
 */
export function runMissingAddress(run: Runner, cwd?: string): string[] {
  try {
    const started = runCompose(
      run,
      [
        'run',
        '--no-deps',
        '-T',
        '--name',
        MISSING_ADDRESS_CONTAINER,
        '-e',
        'GUARDRAILS_SERVER_URL=',
        'app',
      ],
      { cwd, timeoutMs: 60_000 },
    );
    const timedOut = /ETIMEDOUT/.test(started.error ?? '');
    const inspected = run('docker', ['inspect', MISSING_ADDRESS_CONTAINER]);
    let state: { ExitCode?: number; Health?: { Status?: string } } = {};
    try {
      state = JSON.parse(inspected.stdout)[0]?.State ?? {};
    } catch {
      // No readable state: the checks below fail on the missing exit code.
    }
    const logs = run('docker', ['logs', MISSING_ADDRESS_CONTAINER]);
    return evaluateMissingAddress({
      exitCode: state.ExitCode ?? started.status,
      output: `${started.stdout}${started.stderr}${logs.stdout}${logs.stderr}`,
      healthStatus: state.Health?.Status,
      timedOut,
    });
  } finally {
    run('docker', ['rm', '-f', MISSING_ADDRESS_CONTAINER]);
  }
}
