import {
  checkPublishedPorts,
  evaluateMissingAddress,
  MISSING_ADDRESS_CONTAINER,
  runMissingAddress,
} from './verify';
import { composeArgs } from './composeArgs';
import { Runner } from './runner';

const psLine = (service: string, publishers: unknown[]) =>
  JSON.stringify({ Service: service, Publishers: publishers });

describe('checkPublishedPorts (NFR5.1, live)', () => {
  const app = psLine('app', [
    {
      URL: '127.0.0.1',
      TargetPort: 7007,
      PublishedPort: 7007,
      Protocol: 'tcp',
    },
  ]);
  const quiet = (name: string) =>
    psLine(name, [
      { URL: '', TargetPort: 7007, PublishedPort: 0, Protocol: 'tcp' },
    ]);

  it('accepts only the loopback port of the app', () => {
    const out = [app, quiet('postgres'), quiet('guardrails-server')].join('\n');
    expect(checkPublishedPorts(out)).toEqual([]);
  });

  it('accepts the array form of the ps output', () => {
    const out = `[${[app, quiet('postgres')].join(',')}]`;
    expect(checkPublishedPorts(out)).toEqual([]);
  });

  it('finds a second published port and a non-loopback address', () => {
    const wide = psLine('postgres', [
      {
        URL: '0.0.0.0',
        TargetPort: 5432,
        PublishedPort: 5432,
        Protocol: 'tcp',
      },
    ]);
    const found = checkPublishedPorts([app, wide].join('\n')).join('\n');
    expect(found).toMatch(/exactly one/);
    expect(found).toMatch(/postgres.*0\.0\.0\.0/);
  });

  it('fails when nothing is published or the output cannot be read', () => {
    expect(checkPublishedPorts(quiet('app'))).toEqual([
      expect.stringMatching(/exactly one/),
    ]);
    expect(checkPublishedPorts('not json')).toEqual([
      expect.stringMatching(/could not read/),
    ]);
  });
});

describe('evaluateMissingAddress (NFR5.12)', () => {
  const good = {
    exitCode: 1,
    output:
      'The backend could not start: Missing required config value at guardrails.server.url',
    healthStatus: 'starting',
    timedOut: false,
  };

  it('passes on a non-zero exit with the setting named and never healthy', () => {
    expect(evaluateMissingAddress(good)).toEqual([]);
  });

  it('finds an exit code of zero, a missing message and a healthy container', () => {
    expect(evaluateMissingAddress({ ...good, exitCode: 0 })).toEqual([
      expect.stringMatching(/non-zero/),
    ]);
    expect(evaluateMissingAddress({ ...good, output: 'boom' })).toEqual([
      expect.stringMatching(/guardrails\.server\.url/),
    ]);
    expect(
      evaluateMissingAddress({ ...good, healthStatus: 'healthy' }),
    ).toEqual([expect.stringMatching(/never.*healthy/)]);
  });

  it('finds a container that did not exit within the time', () => {
    expect(evaluateMissingAddress({ ...good, timedOut: true })).toEqual([
      expect.stringMatching(/within 60 seconds/),
    ]);
  });
});

describe('runMissingAddress', () => {
  function fake(options: {
    exit?: number;
    health?: string;
    logs?: string;
    timeout?: boolean;
  }) {
    const calls: string[][] = [];
    const run: Runner = (command, args, opts) => {
      calls.push([command, ...args]);
      if (args[0] === 'compose' && args.includes('run')) {
        return options.timeout
          ? { status: null, stdout: '', stderr: '', error: 'ETIMEDOUT' }
          : {
              status: options.exit ?? 1,
              stdout: options.logs ?? '',
              stderr: '',
            };
      }
      if (args[0] === 'inspect') {
        return {
          status: 0,
          stdout: JSON.stringify([
            {
              State: {
                ExitCode: options.exit ?? 1,
                Health: { Status: options.health ?? 'starting' },
              },
            },
          ]),
          stderr: '',
        };
      }
      if (args[0] === 'logs') {
        return {
          status: 0,
          stdout: options.logs ?? 'guardrails.server.url missing',
          stderr: '',
        };
      }
      void opts;
      return { status: 0, stdout: '', stderr: '' };
    };
    return { run, calls };
  }

  it('runs the app without --rm, inspects it, and always removes it', () => {
    const { run, calls } = fake({});
    expect(runMissingAddress(run)).toEqual([]);
    expect(calls[0]).toEqual([
      'docker',
      ...composeArgs([
        'run',
        '--no-deps',
        '-T',
        '--name',
        MISSING_ADDRESS_CONTAINER,
        '-e',
        'GUARDRAILS_SERVER_URL=',
        'app',
      ]),
    ]);
    expect(calls.some(c => c.includes('--rm'))).toBe(false);
    expect(calls[calls.length - 1]).toEqual([
      'docker',
      'rm',
      '-f',
      MISSING_ADDRESS_CONTAINER,
    ]);
  });

  it('reports a container that exits with zero, and still removes it', () => {
    const { run, calls } = fake({ exit: 0 });
    expect(runMissingAddress(run)).toEqual([expect.stringMatching(/non-zero/)]);
    expect(calls[calls.length - 1][1]).toBe('rm');
  });

  it('reports a timeout and stops the container', () => {
    const { run, calls } = fake({ timeout: true });
    expect(runMissingAddress(run).join()).toMatch(/within 60 seconds/);
    expect(calls[calls.length - 1]).toEqual([
      'docker',
      'rm',
      '-f',
      MISSING_ADDRESS_CONTAINER,
    ]);
  });
});
