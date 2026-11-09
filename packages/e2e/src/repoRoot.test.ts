import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './repoRoot';

describe('repoRoot', () => {
  it('finds the repository root that holds the workspace manifest', () => {
    const root = repoRoot();
    expect(existsSync(join(root, 'package.json'))).toBe(true);
    expect(existsSync(join(root, 'packages', 'e2e'))).toBe(true);
  });

  it('gives the same answer for any starting folder inside the package', () => {
    expect(repoRoot(join(__dirname, '..', 'specs'))).toBe(repoRoot());
  });

  it('fails clearly when no root is above the folder', () => {
    expect(() => repoRoot('/')).toThrow(/repository root/);
  });
});
