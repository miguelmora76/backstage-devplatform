import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_FILE, runCompose } from './composeArgs';
import { SERVICES } from './commands';
import { parseEnvFile } from './envFile';
import { Runner } from './runner';
import { scanOutputs } from './scanOutputs';
import { checkPublishedPorts, runMissingAddress } from './verify';

export interface RunDeps {
  run: Runner;
  root: string;
  log: (message: string) => void;
}

/** The report and result folders of the live checks; they are scanned after the run. */
export const OUTPUT_FOLDERS = ['dist/out/report', 'dist/out/results'];

export const playwrightArgs = (projects: string[]): string[] => [
  'workspace',
  'e2e',
  'playwright',
  'test',
  ...projects.flatMap(project => ['--project', project]),
];

function playwright(deps: RunDeps, projects: string[], what: string): void {
  const result = deps.run('yarn', playwrightArgs(projects), {
    cwd: deps.root,
    inherit: true,
  });
  if (result.status !== 0) {
    throw new Error(`The ${what} failed (exit ${result.status}).`);
  }
}

/**
 * `yarn e2e specs`: tables empty after the reset, headers, token and audit
 * checks, then flows, accessibility, keyboard and tree in Chrome and Firefox.
 */
export function runSpecs(deps: RunDeps): void {
  playwright(
    deps,
    ['repeatability', 'http', 'chrome', 'firefox'],
    'end-to-end checks failed',
  );
}

export interface TimingReport {
  limitMs: number;
  report: Record<string, { p95: number; samples: number[] }>;
}

export function formatTiming(timing: TimingReport): string {
  return Object.entries(timing.report)
    .map(([view, { p95 }]) => {
      const flag = p95 > timing.limitMs ? '  OVER' : '';
      return `${view.padEnd(20)} ${String(p95).padStart(6)} ms${flag}`;
    })
    .join('\n');
}

/** `yarn e2e:timing`: 20 loads of each view in Chrome; non-zero above 5000 ms. */
export function runTiming(deps: RunDeps): void {
  let failure: Error | undefined;
  try {
    playwright(
      deps,
      ['timing'],
      'timing check (a view is over the limit or a load failed)',
    );
  } catch (error) {
    failure = error as Error;
  }
  const file = join(
    deps.root,
    'packages',
    'e2e',
    'dist',
    'out',
    'report',
    'timing.json',
  );
  if (existsSync(file)) {
    deps.log(formatTiming(JSON.parse(readFileSync(file, 'utf8'))));
  }
  if (failure) throw failure;
}

/**
 * `yarn e2e checks`: only one loopback port is published (NFR5.1), the app
 * stops with a clear message when the server address is missing (NFR5.12),
 * and no password or token reached the logs or the report (NFR5.10).
 */
export function runChecks(deps: RunDeps): void {
  const problems: string[] = [];

  const ps = runCompose(deps.run, ['ps', '--format', 'json'], {
    cwd: deps.root,
  });
  problems.push(...checkPublishedPorts(ps.stdout));

  problems.push(...runMissingAddress(deps.run, deps.root));

  const envFile = join(deps.root, ENV_FILE);
  const password = existsSync(envFile)
    ? (parseEnvFile(readFileSync(envFile, 'utf8')).POSTGRES_PASSWORD ?? '')
    : '';
  const texts: Record<string, string> = {};
  for (const service of SERVICES) {
    const logs = runCompose(deps.run, ['logs', '--no-color', service], {
      cwd: deps.root,
    });
    texts[`${service} log`] = `${logs.stdout}${logs.stderr}`;
  }
  const hits = scanOutputs({
    folders: OUTPUT_FOLDERS.map(folder =>
      join(deps.root, 'packages', 'e2e', folder),
    ),
    texts,
    secrets: [password],
  });
  for (const hit of hits) {
    problems.push(`NFR5.10: ${hit.kind} found in ${hit.where}.`);
  }

  if (problems.length > 0) {
    problems.forEach(problem => deps.log(problem));
    throw new Error(
      `${problems.length} check(s) failed:\n${problems.join('\n')}`,
    );
  }
  deps.log(
    'Published ports, missing-address start and output scan: all passed.',
  );
}
