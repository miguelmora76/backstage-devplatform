import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_FILE } from './composeArgs';
import {
  formatTiming,
  playwrightArgs,
  runChecks,
  runSpecs,
  runTiming,
} from './e2eRun';
import { repoRoot } from './repoRoot';
import { CommandResult, Runner } from './runner';

function tempRoot(): string {
  const base = join(repoRoot(), 'packages', 'e2e', 'dist', 'test-tmp');
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, 'run-'));
  mkdirSync(join(root, 'packages', 'e2e', 'dist', 'out', 'report'), {
    recursive: true,
  });
  mkdirSync(join(root, 'packages', 'e2e', 'dist', 'out', 'results'), {
    recursive: true,
  });
  writeFileSync(
    join(root, ENV_FILE),
    'POSTGRES_PASSWORD=pw-abcdef0123456789\n',
  );
  return root;
}

const ok: CommandResult = { status: 0, stdout: '', stderr: '' };
const published = JSON.stringify({
  Service: 'app',
  Publishers: [{ URL: '127.0.0.1', PublishedPort: 7007 }],
});

function fakeRun(
  overrides: (args: string[]) => CommandResult | undefined = () => undefined,
) {
  const calls: string[][] = [];
  const run: Runner = (command, args) => {
    calls.push([command, ...args]);
    const special = overrides(args);
    if (special) return special;
    if (args.includes('ps')) return { ...ok, stdout: published };
    if (args[0] === 'inspect') {
      return {
        ...ok,
        stdout: JSON.stringify([
          { State: { ExitCode: 1, Health: { Status: 'starting' } } },
        ]),
      };
    }
    if (args.includes('logs') || args[0] === 'logs') {
      return { ...ok, stdout: 'guardrails.server.url is missing' };
    }
    return ok;
  };
  return { run, calls };
}

describe('playwrightArgs', () => {
  it('runs the tool of the e2e package with one --project per name', () => {
    expect(playwrightArgs(['chrome', 'firefox'])).toEqual([
      'workspace',
      'e2e',
      'playwright',
      'test',
      '--project',
      'chrome',
      '--project',
      'firefox',
    ]);
  });
});

describe('runSpecs and runTiming', () => {
  it('run the browser projects in the planned order and print nothing secret', () => {
    const { run, calls } = fakeRun();
    const logs: string[] = [];
    runSpecs({ run, root: tempRoot(), log: m => logs.push(m) });
    expect(calls[0]).toEqual([
      'yarn',
      ...playwrightArgs(['repeatability', 'http', 'chrome', 'firefox']),
    ]);
  });

  it('fail when the tool fails', () => {
    const run: Runner = () => ({ status: 1, stdout: '', stderr: '' });
    expect(() => runSpecs({ run, root: tempRoot(), log: () => {} })).toThrow(
      /checks failed/,
    );
    expect(() => runTiming({ run, root: tempRoot(), log: () => {} })).toThrow(
      /timing/,
    );
  });

  it('timing runs only the timing project and prints the table when it exists', () => {
    const root = tempRoot();
    writeFileSync(
      join(root, 'packages', 'e2e', 'dist', 'out', 'report', 'timing.json'),
      JSON.stringify({
        limitMs: 5000,
        report: { 'catalog list': { p95: 812, samples: [1] } },
      }),
    );
    const { run, calls } = fakeRun();
    const logs: string[] = [];
    runTiming({ run, root, log: m => logs.push(m) });
    expect(calls[0]).toEqual(['yarn', ...playwrightArgs(['timing'])]);
    expect(logs.join('\n')).toContain('catalog list');
    expect(logs.join('\n')).toContain('812');
  });
});

describe('formatTiming', () => {
  it('shows each view with its 95th percentile and flags one over the limit', () => {
    const text = formatTiming({
      limitMs: 5000,
      report: { a: { p95: 100, samples: [] }, b: { p95: 6000, samples: [] } },
    });
    expect(text).toMatch(/a\s+100 ms/);
    expect(text).toMatch(/b\s+6000 ms\s+OVER/);
  });
});

describe('runChecks', () => {
  it('passes with one loopback port, a good missing-address start and clean outputs', () => {
    const { run } = fakeRun();
    expect(() =>
      runChecks({ run, root: tempRoot(), log: () => {} }),
    ).not.toThrow();
  });

  it('fails when a second port is published', () => {
    const two = `${published}\n${JSON.stringify({
      Service: 'postgres',
      Publishers: [{ URL: '0.0.0.0', PublishedPort: 5432 }],
    })}`;
    const { run } = fakeRun(args =>
      args.includes('ps') ? { ...ok, stdout: two } : undefined,
    );
    expect(() => runChecks({ run, root: tempRoot(), log: () => {} })).toThrow(
      /NFR5\.1/,
    );
  });

  it('fails when the password appears in the compose logs, without printing it', () => {
    const logs: string[] = [];
    const { run } = fakeRun(args =>
      args.includes('logs') &&
      args.includes('--no-color') &&
      !args.includes('guardrails-missing-address')
        ? { ...ok, stdout: 'connect pw-abcdef0123456789' }
        : undefined,
    );
    let message = '';
    try {
      runChecks({ run, root: tempRoot(), log: m => logs.push(m) });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/NFR5\.10/);
    expect(message + logs.join()).not.toContain('pw-abcdef0123456789');
  });

  it('fails when the missing-address start exits with zero', () => {
    const { run } = fakeRun(args =>
      args[0] === 'inspect'
        ? { ...ok, stdout: JSON.stringify([{ State: { ExitCode: 0 } }]) }
        : undefined,
    );
    expect(() => runChecks({ run, root: tempRoot(), log: () => {} })).toThrow(
      /NFR5\.12/,
    );
  });

  it('fails when a token-shaped text is in the report folder', () => {
    const root = tempRoot();
    writeFileSync(
      join(root, 'packages', 'e2e', 'dist', 'out', 'report', 'leak.txt'),
      'x eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.c2ln',
    );
    const { run } = fakeRun();
    expect(() => runChecks({ run, root, log: () => {} })).toThrow(/NFR5\.10/);
  });
});
