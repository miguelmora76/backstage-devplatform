import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeDown, composeReset, composeUp } from './commands';
import { composeArgs, ENV_FILE } from './composeArgs';
import { repoRoot } from './repoRoot';
import { CommandResult, Runner } from './runner';

function tempDir(): string {
  const base = join(repoRoot(), 'packages', 'e2e', 'dist', 'test-tmp');
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, 'cmd-'));
}

const ok: CommandResult = { status: 0, stdout: '', stderr: '' };

interface Recorded {
  calls: string[][];
  logs: string[];
}

function setup(
  handler: (args: string[]) => CommandResult = () => ok,
  env: NodeJS.ProcessEnv = {},
) {
  const recorded: Recorded = { calls: [], logs: [] };
  const run: Runner = (command, args) => {
    recorded.calls.push([command, ...args]);
    return handler(args);
  };
  const root = tempDir();
  const deps = {
    run,
    root,
    env,
    log: (message: string) => recorded.logs.push(message),
    random: () => Buffer.alloc(16, 1),
  };
  return { recorded, deps, root };
}

describe('composeUp', () => {
  it('creates the env file, builds, waits 180 seconds and prints the address', () => {
    const { recorded, deps, root } = setup(args =>
      args[0] === 'volume' ? { status: 1, stdout: '', stderr: '' } : ok,
    );
    composeUp(deps);
    expect(existsSync(join(root, ENV_FILE))).toBe(true);
    const up = recorded.calls.find(c => c.includes('up'));
    expect(up).toEqual([
      'docker',
      ...composeArgs(['up', '--build', '--wait', '--wait-timeout', '180']),
    ]);
    expect(recorded.logs.join('\n')).toContain('http://localhost:7007');
    expect(recorded.logs.join('\n')).not.toContain('01010101');
  });

  it('leaves an existing env file unchanged on a second run', () => {
    const { deps, root } = setup();
    const path = join(root, ENV_FILE);
    writeFileSync(path, 'POSTGRES_PASSWORD=keepme1234\n');
    composeUp(deps);
    expect(require('node:fs').readFileSync(path, 'utf8')).toBe(
      'POSTGRES_PASSWORD=keepme1234\n',
    );
  });

  it('stops with a plain message when docker is missing, before touching files', () => {
    const { deps, root } = setup(() => ({
      status: null,
      stdout: '',
      stderr: '',
      error: 'ENOENT',
    }));
    expect(() => composeUp(deps)).toThrow(/Docker is not installed/);
    expect(existsSync(join(root, ENV_FILE))).toBe(false);
  });

  it('refuses another seed from the environment or the env file', () => {
    const fromEnv = setup(() => ok, { GUARDRAILS_SEED: '5' });
    expect(() => composeUp(fromEnv.deps)).toThrow(/20261106/);
    const fromFile = setup();
    writeFileSync(join(fromFile.root, ENV_FILE), 'GUARDRAILS_SEED=9\n');
    expect(() => composeUp(fromFile.deps)).toThrow(/20261106/);
  });

  it('refuses when the volume exists but the env file is missing', () => {
    const { deps } = setup();
    expect(() => composeUp(deps)).toThrow(/yarn compose:reset/);
  });

  it('prints the status and each service log, then fails, when the wait fails', () => {
    const { recorded, deps } = setup(args => {
      if (args[0] === 'volume') return { status: 1, stdout: '', stderr: '' };
      if (args.includes('up'))
        return { status: 1, stdout: '', stderr: 'unhealthy' };
      if (args.includes('logs'))
        return { status: 0, stdout: 'LOGLINE', stderr: '' };
      return { status: 0, stdout: 'PSTABLE', stderr: '' };
    });
    expect(() => composeUp(deps)).toThrow(/did not become healthy/);
    const text = recorded.logs.join('\n');
    expect(text).toContain('PSTABLE');
    expect(text).toContain('LOGLINE');
    expect(
      recorded.calls.filter(c => c.includes('logs')).map(c => c[c.length - 1]),
    ).toEqual(['postgres', 'guardrails-server', 'app']);
  });
});

describe('composeDown and composeReset', () => {
  it('down keeps the volume', () => {
    const { recorded, deps, root } = setup();
    writeFileSync(join(root, ENV_FILE), 'A=1\n');
    composeDown(deps);
    expect(recorded.calls.pop()).toEqual(['docker', ...composeArgs(['down'])]);
    expect(recorded.logs.join()).toMatch(/kept/);
  });

  it('reset removes the volume and says the data is removed', () => {
    const { recorded, deps, root } = setup();
    writeFileSync(join(root, ENV_FILE), 'A=1\n');
    composeReset(deps);
    expect(recorded.calls.pop()).toEqual([
      'docker',
      ...composeArgs(['down', '--volumes', '--remove-orphans']),
    ]);
    expect(recorded.logs.join()).toMatch(/removed/);
  });

  it('say there is nothing to stop when the env file was never made', () => {
    const { recorded, deps } = setup();
    composeDown(deps);
    composeReset(deps);
    expect(recorded.calls.filter(c => c.includes('down'))).toEqual([]);
    expect(recorded.logs.join()).toMatch(/nothing to stop/i);
  });

  it('fail when docker down fails', () => {
    const { deps, root } = setup(args =>
      args.includes('down')
        ? { status: 2, stdout: '', stderr: 'boom' }
        : { status: 0, stdout: '', stderr: '' },
    );
    writeFileSync(join(root, ENV_FILE), 'A=1\n');
    expect(() => composeDown(deps)).toThrow(/docker compose down failed/);
  });
});
