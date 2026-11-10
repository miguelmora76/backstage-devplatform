import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  comparePlanFiles,
  comparePlans,
  fetchPlan,
  snapshotPlan,
} from './planCompare';
import { repoRoot } from './repoRoot';

function tempDir(): string {
  const base = join(repoRoot(), 'packages', 'e2e', 'dist', 'test-tmp');
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, 'plan-'));
}

describe('the command helpers', () => {
  const fetchOf = (body: string) =>
    (async (url: string) =>
      url.includes('/auth/')
        ? {
            ok: true,
            status: 200,
            json: async () => ({ backstageIdentity: { token: 't' } }),
          }
        : {
            ok: true,
            status: 200,
            arrayBuffer: async () => Buffer.from(body),
          }) as unknown as typeof fetch;

  it('snapshotPlan writes the response bytes to the file', async () => {
    // The folder may not exist yet (dist/out is made by the first run).
    const file = join(tempDir(), 'new', 'out', 'plan.json');
    const logs: string[] = [];
    await snapshotPlan(file, fetchOf('{"a":1}'), m => logs.push(m));
    expect(readFileSync(file, 'utf8')).toBe('{"a":1}');
    expect(logs.join('\n')).toContain('7 bytes');
  });

  it('comparePlanFiles passes for equal files, fails for different or missing ones', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'a'), 'same');
    writeFileSync(join(dir, 'b'), 'same');
    writeFileSync(join(dir, 'c'), 'other');
    const logs: string[] = [];
    comparePlanFiles(join(dir, 'a'), join(dir, 'b'), m => logs.push(m));
    expect(logs.join('\n')).toMatch(/same plan/i);
    expect(() =>
      comparePlanFiles(join(dir, 'a'), join(dir, 'c'), () => undefined),
    ).toThrow(/NFR7\.3.*differ/);
    expect(() =>
      comparePlanFiles(join(dir, 'a'), join(dir, 'nope'), () => undefined),
    ).toThrow(/second plan.*missing/);
  });
});

describe('comparePlans (NFR7.3)', () => {
  it('passes for the same bytes', () => {
    expect(comparePlans('{"items":[1]}', Buffer.from('{"items":[1]}'))).toEqual(
      [],
    );
  });

  it('fails for a difference of one byte', () => {
    expect(comparePlans('{"items":[1]}', '{"items":[2]}')[0]).toMatch(
      /NFR7\.3.*differ/,
    );
  });

  it('fails when either side is missing or empty', () => {
    expect(comparePlans(undefined, 'x')[0]).toMatch(/first plan.*missing/i);
    expect(comparePlans('x', undefined)[0]).toMatch(/second plan.*missing/i);
    expect(comparePlans('', '')[0]).toMatch(/first plan.*missing/i);
  });
});

describe('fetchPlan', () => {
  function fakeFetch(
    handler: (
      url: string,
      init?: any,
    ) => Partial<Response> & { bytes?: string },
  ) {
    const seen: Array<{ url: string; headers?: Record<string, string> }> = [];
    const fn = (async (url: string, init?: any) => {
      seen.push({ url, headers: init?.headers });
      const r = handler(url, init);
      return {
        ok: r.ok ?? true,
        status: r.status ?? 200,
        json: async () => (r as any).json,
        arrayBuffer: async () => Buffer.from(r.bytes ?? ''),
      };
    }) as unknown as typeof fetch;
    return { fn, seen };
  }

  it('signs in as sam and returns the plan response as bytes', async () => {
    const { fn, seen } = fakeFetch(url =>
      url.includes('/api/auth/demo/start')
        ? ({ json: { backstageIdentity: { token: 'tok-1' } } } as any)
        : { bytes: '{"items":[]}' },
    );
    const bytes = await fetchPlan(
      fn,
      'http://localhost:7007',
      'checkout-bridge',
    );
    expect(bytes.toString()).toBe('{"items":[]}');
    expect(seen[0].url).toBe(
      'http://localhost:7007/api/auth/demo/start?userId=sam',
    );
    expect(seen[1].url).toBe(
      'http://localhost:7007/api/guardrails/services/checkout-bridge/plan',
    );
    expect(seen[1].headers).toEqual({ Authorization: 'Bearer tok-1' });
  });

  it('fails plainly, without the token, when sign-in or the read fails', async () => {
    const signIn = fakeFetch(() => ({ ok: false, status: 500 }));
    await expect(fetchPlan(signIn.fn, 'http://x', 's')).rejects.toThrow(
      /sign-in.*500/i,
    );
    const noToken = fakeFetch(() => ({ json: {} }) as any);
    await expect(fetchPlan(noToken.fn, 'http://x', 's')).rejects.toThrow(
      /no token/i,
    );
    const read = fakeFetch(url =>
      url.includes('/auth/')
        ? ({ json: { backstageIdentity: { token: 'secret-tok' } } } as any)
        : { ok: false, status: 502 },
    );
    const error = await fetchPlan(read.fn, 'http://x', 's').catch(e => e);
    expect(error.message).toMatch(/plan.*502/);
    expect(error.message).not.toContain('secret-tok');
  });
});
