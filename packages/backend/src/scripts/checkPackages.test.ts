import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const script = join(__dirname, '..', '..', 'scripts', 'check-packages.mjs');
const fixtures = join(__dirname, '..', 'testing', 'fixtures');

function run(root: string) {
  return spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
}

describe('check-packages (NFR5.8)', () => {
  it('passes when every declared package is on the allow-list', () => {
    const result = run(join(fixtures, 'packages-good'));
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/allowed/);
  });

  it('fails and names a package that is not on the allow-list', () => {
    const result = run(join(fixtures, 'packages-bad'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('left-pad');
    expect(result.stderr).not.toContain('react-dom,');
  });

  it('passes on the real backend and app packages', () => {
    const backend = join(__dirname, '..', '..');
    expect(() =>
      execFileSync(process.execPath, [script, backend], { encoding: 'utf8' }),
    ).not.toThrow();
    expect(() =>
      execFileSync(process.execPath, [script, join(backend, '..', 'app')], {
        encoding: 'utf8',
      }),
    ).not.toThrow();
  });
});
