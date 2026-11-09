import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const packages = join(__dirname, '..', '..', '..');
const eslint = join(packages, '..', 'node_modules', '.bin', 'eslint');

function lint(pkg: string, file: string) {
  return spawnSync(eslint, ['--no-ignore', file], {
    cwd: join(packages, pkg),
    encoding: 'utf8',
  });
}

describe('lint rules that keep the security and state rules (NFR1.5, NFR5.3, NFR5.4, NFR5.5, NFR1.9)', () => {
  it('fails the backend lint on module-level state, an address and a port in source', () => {
    const result = lint('backend', 'src/lintFixtures/moduleState.ts');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('No module-level mutable state');
    expect(result.stdout).toContain('Do not write an address');
    expect(result.stdout).toContain('Do not write a port');
  });

  it('fails the app lint on raw HTML, console, storage, module-level state, an address and a port', () => {
    const result = lint('app', 'src/lintFixtures/rawHtml.tsx');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Raw-HTML insertion is not allowed');
    expect(result.stdout).toContain('no-console');
    expect(result.stdout).toContain('The sign-in is held in memory only');
    expect(result.stdout).toContain('No module-level mutable state');
    expect(result.stdout).toContain('Do not write an address');
    expect(result.stdout).toContain('Do not write a port');
  });

  it('passes the real source of both packages', () => {
    for (const pkg of ['backend', 'app']) {
      const result = spawnSync(eslint, ['src', '--ext', 'ts,tsx'], {
        cwd: join(packages, pkg),
        encoding: 'utf8',
      });
      expect({ pkg, status: result.status, out: result.stdout }).toEqual({
        pkg,
        status: 0,
        out: '',
      });
    }
  });
});
