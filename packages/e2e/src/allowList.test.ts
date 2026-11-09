import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkAllowList, parseAllowList } from './allowList';
import { repoRoot } from './repoRoot';

describe('allow-list check', () => {
  it('parses names and skips comments and blank lines', () => {
    expect([...parseAllowList('# c\n\n a \nb\n')]).toEqual(['a', 'b']);
  });

  it('accepts a manifest whose packages are all listed', () => {
    const manifest = { dependencies: { a: '1' }, devDependencies: { b: '1' } };
    expect(checkAllowList(manifest, 'a\nb\n')).toEqual([]);
  });

  it('returns the sorted names that are not listed, including peers', () => {
    const manifest = {
      dependencies: { z: '1', a: '1' },
      peerDependencies: { m: '1' },
    };
    expect(checkAllowList(manifest, 'a\n')).toEqual(['m', 'z']);
  });

  it('holds for the real package of this unit', () => {
    const dir = join(repoRoot(), 'packages', 'e2e');
    const manifest = JSON.parse(
      readFileSync(join(dir, 'package.json'), 'utf8'),
    );
    const allowed = readFileSync(join(dir, 'allowed-packages.txt'), 'utf8');
    expect(checkAllowList(manifest, allowed)).toEqual([]);
  });

  it('pins every dependency to an exact version except the Backstage CLI and types', () => {
    const dir = join(repoRoot(), 'packages', 'e2e');
    const manifest = JSON.parse(
      readFileSync(join(dir, 'package.json'), 'utf8'),
    );
    const loose = Object.entries<string>(manifest.devDependencies).filter(
      ([name, version]) =>
        !/^\d+\.\d+\.\d+$/.test(version) &&
        !['@backstage/cli', '@types/node'].includes(name),
    );
    expect(loose).toEqual([]);
  });
});
