import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_FILE, PROJECT_NAME, composeArgs, runCompose } from './composeArgs';
import { repoRoot } from './repoRoot';
import { CommandResult, Runner } from './runner';

describe('composeArgs', () => {
  it('puts the project name and the env file on every call', () => {
    expect(composeArgs(['ps'])).toEqual([
      'compose',
      '--project-name',
      PROJECT_NAME,
      '--env-file',
      ENV_FILE,
      'ps',
    ]);
    expect(PROJECT_NAME).toBe('guardrails-sample');
    expect(ENV_FILE).toBe('.env.compose');
  });

  it('keeps the order of the extra arguments', () => {
    const args = composeArgs([
      'up',
      '--build',
      '--wait',
      '--wait-timeout',
      '180',
    ]);
    expect(args.slice(5)).toEqual([
      'up',
      '--build',
      '--wait',
      '--wait-timeout',
      '180',
    ]);
  });

  it('refuses a call that tries to name its own project or env file', () => {
    expect(() => composeArgs(['--env-file', '.env', 'up'])).toThrow(
      /project name and env file/,
    );
    expect(() => composeArgs(['-p', 'x', 'up'])).toThrow(
      /project name and env file/,
    );
    expect(() => composeArgs(['--project-name', 'x', 'up'])).toThrow(
      /project name and env file/,
    );
  });

  it('runCompose calls the runner with docker and the built arguments', () => {
    const calls: Array<[string, string[]]> = [];
    const run: Runner = (command, args) => {
      calls.push([command, args]);
      return { status: 0, stdout: 'ok', stderr: '' } as CommandResult;
    };
    const result = runCompose(run, ['down']);
    expect(result.stdout).toBe('ok');
    expect(calls).toEqual([['docker', composeArgs(['down'])]]);
  });

  it('is the only place that builds a docker compose call in src and bin', () => {
    const root = join(repoRoot(), 'packages', 'e2e');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'testing') walk(path);
        } else if (
          /\.(ts|mjs)$/.test(entry.name) &&
          !entry.name.endsWith('.test.ts')
        ) {
          files.push(path);
        }
      }
    };
    walk(join(root, 'src'));
    walk(join(root, 'bin'));
    walk(join(root, 'specs'));
    const offenders = files.filter(file => {
      if (file.endsWith('composeArgs.ts')) return false;
      return /['"`]compose['"`]/.test(readFileSync(file, 'utf8'));
    });
    expect(offenders).toEqual([]);
  });
});
