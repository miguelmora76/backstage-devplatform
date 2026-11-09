import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  SEED,
  ensureEnvFile,
  generatePassword,
  parseEnvFile,
  refuseOtherSeed,
} from './envFile';
import { repoRoot } from './repoRoot';

// Test folders live inside the repository's ignored output folder, not /tmp.
function tempDir(): string {
  const base = join(repoRoot(), 'packages', 'e2e', 'dist', 'test-tmp');
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, 'env-'));
}

const fixedRandom = (bytes: number) => Buffer.alloc(bytes, 0xab);

describe('generatePassword', () => {
  it('gives 32 characters that are safe in an env file and a connection string', () => {
    const password = generatePassword(fixedRandom);
    expect(password).toMatch(/^[0-9a-f]{32}$/);
  });

  it('uses the secure random source by default and differs between calls', () => {
    expect(generatePassword()).not.toBe(generatePassword());
  });
});

describe('ensureEnvFile', () => {
  it('creates the file once with a random password and mode 0600', () => {
    const dir = tempDir();
    const result = ensureEnvFile({
      dir,
      random: fixedRandom,
      volumeExists: () => false,
    });
    expect(result).toEqual({ created: true, path: join(dir, '.env.compose') });
    const values = parseEnvFile(readFileSync(result.path, 'utf8'));
    expect(values.POSTGRES_PASSWORD).toBe('ab'.repeat(16));
    expect(values).toMatchObject({
      POSTGRES_HOST: 'postgres',
      POSTGRES_PORT: '5432',
      POSTGRES_DB: 'guardrails',
      POSTGRES_USER: 'guardrails',
    });
    expect(statSync(result.path).mode & 0o777).toBe(0o600);
  });

  it('never overwrites an existing file', () => {
    const dir = tempDir();
    const path = join(dir, '.env.compose');
    writeFileSync(path, 'POSTGRES_PASSWORD=mine\n');
    const result = ensureEnvFile({
      dir,
      random: fixedRandom,
      volumeExists: () => true,
    });
    expect(result.created).toBe(false);
    expect(readFileSync(path, 'utf8')).toBe('POSTGRES_PASSWORD=mine\n');
  });

  it('never prints the password and does not return it', () => {
    const dir = tempDir();
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(process.stdout, 'write').mockImplementation(() => true),
    ];
    try {
      const result = ensureEnvFile({
        dir,
        random: fixedRandom,
        volumeExists: () => false,
      });
      expect(JSON.stringify(result)).not.toContain('abab');
      spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    } finally {
      spies.forEach(spy => spy.mockRestore());
    }
  });

  it('refuses when the volume exists but the file is missing, naming the reset', () => {
    const dir = tempDir();
    expect(() =>
      ensureEnvFile({ dir, random: fixedRandom, volumeExists: () => true }),
    ).toThrow(/yarn compose:reset/);
    expect(existsSync(join(dir, '.env.compose'))).toBe(false);
  });
});

describe('parseEnvFile', () => {
  it('reads values, skips comments and blank lines and keeps equals signs', () => {
    expect(parseEnvFile('# c\n\nA=1\nB=x=y\n  C = 3 \nbad line\n')).toEqual({
      A: '1',
      B: 'x=y',
      C: '3',
    });
  });
});

describe('refuseOtherSeed', () => {
  it('accepts no seed and the fixed seed', () => {
    expect(() => refuseOtherSeed({}, '')).not.toThrow();
    expect(() => refuseOtherSeed({ GUARDRAILS_SEED: SEED }, '')).not.toThrow();
    expect(SEED).toBe('20261106');
  });

  it('refuses another seed in the environment', () => {
    expect(() => refuseOtherSeed({ GUARDRAILS_SEED: '1' }, '')).toThrow(
      /20261106/,
    );
  });

  it('refuses another seed in the env file', () => {
    expect(() => refuseOtherSeed({}, 'GUARDRAILS_SEED=7\n')).toThrow(
      /GUARDRAILS_SEED/,
    );
  });
});
