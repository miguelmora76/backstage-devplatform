import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkIgnoreFiles } from './ignoreCheck';
import { repoRoot } from './repoRoot';

const root = repoRoot();
const read = (name: string) => readFileSync(join(root, name), 'utf8');

describe('.dockerignore and .gitignore (real files)', () => {
  it('break none of the rules', () => {
    expect(
      checkIgnoreFiles({
        dockerignore: read('.dockerignore'),
        gitignore: read('.gitignore'),
      }),
    ).toEqual([]);
  });

  it('keep the env files out of the build context and out of git (NFR5.2)', () => {
    expect(read('.dockerignore')).toMatch(/^\.env\*$/m);
    expect(read('.gitignore')).toMatch(/^\.env\.compose$/m);
    expect(read('.gitignore')).toMatch(/^\.env$/m);
  });
});

describe('checkIgnoreFiles', () => {
  const good = {
    dockerignore: '.env*\ncoverage\ndist-types\n.git\n',
    gitignore: '.env\n.env.compose\n',
  };

  it('accepts a complete pair, with or without the **/ prefix', () => {
    expect(checkIgnoreFiles(good)).toEqual([]);
    expect(
      checkIgnoreFiles({
        ...good,
        dockerignore: '.env*\n**/coverage\n**/dist-types\n',
      }),
    ).toEqual([]);
  });

  it('finds a missing .env* entry in .dockerignore', () => {
    expect(
      checkIgnoreFiles({ ...good, dockerignore: 'coverage\ndist-types\n' }),
    ).toEqual([expect.stringMatching(/\.dockerignore.*\.env\*/)]);
  });

  it('finds missing coverage and dist-types entries', () => {
    const found = checkIgnoreFiles({ ...good, dockerignore: '.env*\n' }).join();
    expect(found).toMatch(/coverage/);
    expect(found).toMatch(/dist-types/);
  });

  it('finds .env.compose or .env missing in .gitignore', () => {
    expect(checkIgnoreFiles({ ...good, gitignore: '.env\n' })).toEqual([
      expect.stringMatching(/\.gitignore.*\.env\.compose/),
    ]);
    expect(checkIgnoreFiles({ ...good, gitignore: '.env.compose\n' })).toEqual([
      expect.stringMatching(/\.gitignore.*\.env\b/),
    ]);
  });

  it('ignores comments when looking for entries', () => {
    expect(
      checkIgnoreFiles({ ...good, gitignore: '# .env\n# .env.compose\n' }),
    ).toHaveLength(2);
  });
});
