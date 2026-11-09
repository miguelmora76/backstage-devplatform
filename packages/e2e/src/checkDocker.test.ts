import { checkDocker } from './checkDocker';
import { realRunner, Runner } from './runner';

const ok = { status: 0, stdout: 'v', stderr: '' };

describe('checkDocker', () => {
  it('passes when docker and compose v2 answer', () => {
    const seen: string[][] = [];
    const run: Runner = (_c, args) => {
      seen.push(args);
      return ok;
    };
    expect(() => checkDocker(run)).not.toThrow();
    expect(seen).toEqual([['--version'], ['compose', 'version']]);
  });

  it('gives a plain message when the docker command is missing', () => {
    const run: Runner = () => ({
      status: null,
      stdout: '',
      stderr: '',
      error: 'ENOENT',
    });
    expect(() => checkDocker(run)).toThrow(/Docker is not installed/);
  });

  it('gives a plain message when compose v2 is missing', () => {
    const run: Runner = (_c, args) =>
      args[0] === 'compose' ? { status: 1, stdout: '', stderr: 'x' } : ok;
    expect(() => checkDocker(run)).toThrow(/Docker Compose v2/);
  });
});

describe('realRunner', () => {
  it('runs a command and returns its output and status', () => {
    const result = realRunner(process.execPath, ['-e', 'console.log("hi")']);
    expect(result).toMatchObject({ status: 0, stdout: 'hi\n' });
  });

  it('reports a missing command as an error, not an exception', () => {
    const result = realRunner('definitely-not-a-command-xyz', []);
    expect(result.status).toBeNull();
    expect(result.error).toBeDefined();
  });
});
