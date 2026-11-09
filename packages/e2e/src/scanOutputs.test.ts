import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './repoRoot';
import { readZipEntries, scanOutputs } from './scanOutputs';
import { makeZip } from './testing/zip';

function tempDir(): string {
  const base = join(repoRoot(), 'packages', 'e2e', 'dist', 'test-tmp');
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, 'scan-'));
}

// Made-up values; none is a real secret.
const PASSWORD = 'pw-0123456789abcdef0123456789abcdef';
const TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.c2ln';

describe('scanOutputs', () => {
  it('finds nothing in a clean folder and clean log text', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'report.txt'), 'all 30 checks passed');
    expect(
      scanOutputs({
        folders: [dir],
        texts: { logs: 'started' },
        secrets: [PASSWORD],
      }),
    ).toEqual([]);
  });

  it('finds the database password in a plain file', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'a.log'), `connect with ${PASSWORD} ok`);
    const hits = scanOutputs({ folders: [dir], secrets: [PASSWORD] });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: 'secret' });
    expect(hits[0].where).toContain('a.log');
  });

  it('finds a token the specs obtained, and never repeats the value in the hit', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'b.txt'), `header ${TOKEN}`);
    const hits = scanOutputs({ folders: [dir], secrets: [TOKEN] });
    expect(JSON.stringify(hits)).not.toContain(TOKEN);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('finds token-shaped text and a Bearer value even when not listed', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'c.txt'), `x ${TOKEN}`);
    writeFileSync(join(dir, 'd.txt'), 'Authorization: Bearer abcDEF123._-xyz');
    const kinds = scanOutputs({ folders: [dir], secrets: [] }).map(h => h.kind);
    expect(kinds).toEqual(['token-shape', 'bearer']);
  });

  it('finds a secret in an entry of a zip file, stored or deflated', () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, 'trace.zip'),
      makeZip([
        { name: 'clean.txt', data: 'nothing here' },
        { name: 'net.json', data: `{"h":"${PASSWORD}"}`, deflate: true },
        { name: 'tok.txt', data: TOKEN },
      ]),
    );
    const hits = scanOutputs({ folders: [dir], secrets: [PASSWORD] });
    expect(hits.map(h => h.where)).toEqual([
      expect.stringContaining('trace.zip!net.json'),
      expect.stringContaining('trace.zip!tok.txt'),
    ]);
  });

  it('scans nested folders and the text passed in (compose logs)', () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'deep', 'er'), { recursive: true });
    writeFileSync(join(dir, 'deep', 'er', 'e.txt'), PASSWORD);
    const hits = scanOutputs({
      folders: [dir],
      texts: { 'compose logs': `line ${PASSWORD}` },
      secrets: [PASSWORD],
    });
    expect(hits.map(h => h.where)).toEqual([
      'compose logs',
      expect.stringContaining('e.txt'),
    ]);
  });

  it('ignores a folder that does not exist and secrets that are empty', () => {
    expect(
      scanOutputs({
        folders: ['/nonexistent-folder-xyz'],
        secrets: ['', 'ab'],
      }),
    ).toEqual([]);
  });

  it('skips a corrupt zip without throwing and scans it as raw text', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'bad.zip'), `not a zip ${PASSWORD}`);
    expect(scanOutputs({ folders: [dir], secrets: [PASSWORD] })).toHaveLength(
      1,
    );
  });
});

describe('readZipEntries', () => {
  it('lists names and contents', () => {
    const entries = readZipEntries(
      makeZip([
        { name: 'a', data: 'one' },
        { name: 'b', data: 'two', deflate: true },
      ]),
    );
    expect(entries.map(e => [e.name, e.content])).toEqual([
      ['a', 'one'],
      ['b', 'two'],
    ]);
  });

  it('throws on bytes that are not a zip', () => {
    expect(() => readZipEntries(Buffer.from('hello'))).toThrow(/zip/);
  });
});
