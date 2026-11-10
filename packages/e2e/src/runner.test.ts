import { realRunner } from './runner';

describe('realRunner', () => {
  it('returns the output and the exit code of a command', () => {
    const result = realRunner(process.execPath, [
      '-e',
      'process.stdout.write("out"); process.stderr.write("err"); process.exit(3)',
    ]);
    expect(result).toMatchObject({ status: 3, stdout: 'out', stderr: 'err' });
    expect(result.error).toBeUndefined();
  });

  it('writes the input to standard input, not to an argument', () => {
    const result = realRunner(
      process.execPath,
      ['-e', 'process.stdin.pipe(process.stdout)'],
      { input: 'secret-on-stdin' },
    );
    expect(result.stdout).toBe('secret-on-stdin');
  });

  it('reports a command that cannot be started', () => {
    const result = realRunner('definitely-not-a-command-xyz', []);
    expect(result.status).toBeNull();
    expect(result.error).toMatch(/ENOENT/);
  });
});
