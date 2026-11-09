import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { GuardrailsApi, type Credential } from './guardrailsApi';
import type { Result } from './failures';

const BASE = 'http://backend.test/api/guardrails';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeApi(
  credential: Partial<Credential> = {},
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
) {
  const cred: Credential = {
    getToken: async () => undefined,
    canRefresh: () => false,
    refresh: async () => false,
    ...credential,
  };
  return new GuardrailsApi({
    discoveryApi: {
      getBaseUrl: async (id: string) => `http://backend.test/api/${id}`,
    },
    fetchApi: { fetch: fetchImpl },
    credential: cred,
  });
}

function valueOf<T>(r: Result<T>): T {
  if (!r.ok) {
    throw new Error(`expected ok, got ${JSON.stringify(r.failure)}`);
  }
  return r.value;
}

describe('GuardrailsApi addresses (NFR5.6)', () => {
  it('uses the discovery address of the guardrails plugin', async () => {
    let seen = '';
    server.use(
      http.get(`${BASE}/me`, ({ request }) => {
        seen = request.url;
        return HttpResponse.json({
          userId: 'sam',
          name: 'Sam',
          role: 'service-owner',
        });
      }),
    );
    const me = valueOf(await makeApi().me());
    expect(me.userId).toBe('sam');
    expect(seen).toBe(`${BASE}/me`);
  });

  it('encodes service names and change ids containing / ? # and spaces', async () => {
    const seen: string[] = [];
    server.use(
      http.get(/.*/, ({ request }) => {
        seen.push(new URL(request.url).pathname + new URL(request.url).search);
        return HttpResponse.json({ service: 'x', items: [] });
      }),
    );
    const api = makeApi();
    await api.plan('a/b c?d#e');
    await api.ciRuns('a/b c?d#e');
    await api.changes('a/b c?d#e');
    await api.change('id/with ?#');
    expect(seen).toEqual([
      '/api/guardrails/services/a%2Fb%20c%3Fd%23e/plan',
      '/api/guardrails/services/a%2Fb%20c%3Fd%23e/ci-runs',
      '/api/guardrails/services/a%2Fb%20c%3Fd%23e/changes',
      '/api/guardrails/changes/id%2Fwith%20%3F%23',
    ]);
  });

  it('asks the audit for pageSize 10 and sends only the chosen filters', async () => {
    let query = '';
    server.use(
      http.get(`${BASE}/services/pay/audit`, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({
          items: [],
          page: 2,
          pageSize: 10,
          total: 0,
        });
      }),
    );
    const api = makeApi();
    await api.audit('pay', {}, 2);
    expect(new URLSearchParams(query).get('pageSize')).toBe('10');
    expect(new URLSearchParams(query).get('page')).toBe('2');
    expect([...new URLSearchParams(query).keys()].sort()).toEqual([
      'page',
      'pageSize',
    ]);
    await api.audit(
      'pay',
      {
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-02T23:59:59.999Z',
        actor: 'sam',
        action: 'approve',
        outcome: 'applied',
      },
      1,
    );
    const params = new URLSearchParams(query);
    expect(params.get('actor')).toBe('sam');
    expect(params.get('action')).toBe('approve');
    expect(params.get('outcome')).toBe('applied');
    expect(params.get('from')).toBe('2026-11-01T00:00:00.000Z');
    expect(params.get('to')).toBe('2026-11-02T23:59:59.999Z');
  });
});

describe('GuardrailsApi credential and bodies (NFR5.3, NFR5.4)', () => {
  it('sends the chosen demo user token as the Authorization header', async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${BASE}/me`, ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({
          userId: 'priya',
          name: 'Priya',
          role: 'platform-engineer',
        });
      }),
    );
    await makeApi({ getToken: async () => 'tok-priya' }).me();
    expect(auth).toBe('Bearer tok-priya');
  });

  it('adds no Authorization header when no demo user is chosen (the app credential is used)', async () => {
    let auth: string | null = 'unset';
    server.use(
      http.get(`${BASE}/me`, ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({
          userId: 'sam',
          name: 'Sam',
          role: 'service-owner',
        });
      }),
    );
    await makeApi().me();
    expect(auth).toBeNull();
  });

  it('sends only kind and target when proposing', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/services/pay/changes`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ changeId: 'c1' }, { status: 201 });
      }),
    );
    await makeApi().propose('pay', 'upgrade', 'lib-a');
    expect(body).toEqual({ kind: 'upgrade', target: 'lib-a' });
  });

  it('sends only the reason, exactly as typed, when deciding', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(
        /\/changes\/c1\/(approve|reject|retry)$/,
        async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json({ changeId: 'c1' });
        },
      ),
    );
    const api = makeApi();
    await api.approve('c1', '  Safe, tested.  ');
    await api.reject('c1', 'No');
    await api.retry('c1', 'Again');
    expect(bodies).toEqual([
      { reason: '  Safe, tested.  ' },
      { reason: 'No' },
      { reason: 'Again' },
    ]);
    for (const b of bodies) {
      expect(JSON.stringify(b)).not.toMatch(/actor|role|userId/);
    }
  });
});

describe('GuardrailsApi failures (NFR5.10)', () => {
  it.each([
    [503, 'SERVER_UNREACHABLE', { kind: 'server-unreachable' }],
    [401, 'UNAUTHENTICATED', { kind: 'unauthenticated' }],
    [404, 'NOT_FOUND', { kind: 'api', code: 'NOT_FOUND', status: 404 }],
    [
      409,
      'ALREADY_DECIDED',
      { kind: 'api', code: 'ALREADY_DECIDED', status: 409 },
    ],
    [409, 'NOT_FAILED', { kind: 'api', code: 'NOT_FAILED', status: 409 }],
    [409, 'NOT_ELIGIBLE', { kind: 'api', code: 'NOT_ELIGIBLE', status: 409 }],
    [
      409,
      'CLAIM_RELEASED',
      { kind: 'api', code: 'CLAIM_RELEASED', status: 409 },
    ],
    [
      403,
      'AUDITOR_READ_ONLY',
      { kind: 'api', code: 'AUDITOR_READ_ONLY', status: 403 },
    ],
    [403, 'SELF_DECISION', { kind: 'api', code: 'SELF_DECISION', status: 403 }],
    [400, 'EMPTY_REASON', { kind: 'api', code: 'EMPTY_REASON', status: 400 }],
    [400, 'INVALID_INPUT', { kind: 'api', code: 'INVALID_INPUT', status: 400 }],
    [
      500,
      'INTERNAL_ERROR',
      { kind: 'api', code: 'INTERNAL_ERROR', status: 500 },
    ],
    [500, 'SOMETHING_NEW', { kind: 'unknown', status: 500 }],
  ])('maps %i %s to a typed failure', async (status, code, expected) => {
    server.use(
      http.post(`${BASE}/changes/c1/approve`, () =>
        HttpResponse.json(
          { error: { code, message: 'secret detail from the server' } },
          { status },
        ),
      ),
    );
    const r = await makeApi().approve('c1', 'x');
    expect(r).toEqual({ ok: false, failure: expected });
    // Response bodies and messages are discarded.
    expect(JSON.stringify(r)).not.toContain('secret detail');
  });

  it('treats a body that is not JSON, or a lost connection, as no answer or unknown', async () => {
    server.use(
      http.get(
        `${BASE}/me`,
        () => new HttpResponse('<html>oops</html>', { status: 502 }),
      ),
    );
    expect(await makeApi().me()).toEqual({
      ok: false,
      failure: { kind: 'unknown', status: 502 },
    });
    server.use(http.get(`${BASE}/me`, () => HttpResponse.error()));
    expect(await makeApi().me()).toEqual({
      ok: false,
      failure: { kind: 'no-answer' },
    });
  });

  it('does not write response text to the console', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map(m =>
      jest.spyOn(console, m).mockImplementation(() => {}),
    );
    server.use(
      http.get(`${BASE}/me`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'secret detail' } },
          { status: 500 },
        ),
      ),
    );
    await makeApi().me();
    for (const s of spies) {
      expect(s).not.toHaveBeenCalled();
      s.mockRestore();
    }
  });
});

describe('GuardrailsApi limits (NFR1.4)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const neverAnswers: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      );
    });

  it('gives up on a read after 5 seconds as no answer', async () => {
    const pending = makeApi({}, neverAnswers).plan('pay');
    await jest.advanceTimersByTimeAsync(4999);
    let settled = false;
    pending.then(() => {
      settled = true;
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({
      ok: false,
      failure: { kind: 'no-answer' },
    });
  });

  it('gives up on a write after 12 seconds as no answer', async () => {
    const pending = makeApi({}, neverAnswers).approve('c1', 'ok');
    await jest.advanceTimersByTimeAsync(11999);
    let settled = false;
    pending.then(() => {
      settled = true;
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({
      ok: false,
      failure: { kind: 'no-answer' },
    });
  });

  it('stops a call when the caller aborts it', async () => {
    const ctl = new AbortController();
    const pending = makeApi({}, neverAnswers).plan('pay', {
      signal: ctl.signal,
    });
    ctl.abort();
    expect(await pending).toEqual({
      ok: false,
      failure: { kind: 'no-answer' },
    });
  });
});

describe('GuardrailsApi 401 refresh (NFR5.2)', () => {
  it('refreshes once and repeats a read when a demo user is chosen', async () => {
    let calls = 0;
    const tokens: Array<string | null> = [];
    server.use(
      http.get(`${BASE}/me`, ({ request }) => {
        calls += 1;
        tokens.push(request.headers.get('authorization'));
        if (calls === 1) {
          return HttpResponse.json(
            { error: { code: 'UNAUTHENTICATED', message: 'x' } },
            { status: 401 },
          );
        }
        return HttpResponse.json({
          userId: 'sam',
          name: 'Sam',
          role: 'service-owner',
        });
      }),
    );
    let token = 'old';
    const refresh = jest.fn(async () => {
      token = 'new';
      return true;
    });
    const r = await makeApi({
      getToken: async () => token,
      canRefresh: () => true,
      refresh,
    }).me();
    expect(r.ok).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual(['Bearer old', 'Bearer new']);
  });

  it('shows unauthenticated after a second 401', async () => {
    server.use(
      http.get(`${BASE}/me`, () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'x' } },
          { status: 401 },
        ),
      ),
    );
    const refresh = jest.fn(async () => true);
    const r = await makeApi({
      getToken: async () => 't',
      canRefresh: () => true,
      refresh,
    }).me();
    expect(r).toEqual({ ok: false, failure: { kind: 'unauthenticated' } });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('never repeats a write on its own', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/changes/c1/approve`, () => {
        calls += 1;
        return HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'x' } },
          { status: 401 },
        );
      }),
    );
    const refresh = jest.fn(async () => true);
    const r = await makeApi({
      getToken: async () => 't',
      canRefresh: () => true,
      refresh,
    }).approve('c1', 'ok');
    expect(r).toEqual({ ok: false, failure: { kind: 'unauthenticated' } });
    expect(calls).toBe(1);
  });

  it('does not refresh when no demo user is chosen', async () => {
    server.use(
      http.get(`${BASE}/me`, () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'x' } },
          { status: 401 },
        ),
      ),
    );
    const refresh = jest.fn(async () => true);
    const r = await makeApi({ canRefresh: () => false, refresh }).me();
    expect(r).toEqual({ ok: false, failure: { kind: 'unauthenticated' } });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('GuardrailsApi demo user list (NFR5.9)', () => {
  it('returns the list when the demo sign-in is on', async () => {
    server.use(
      http.get(`${BASE}/demo-users`, () =>
        HttpResponse.json({
          items: [{ userId: 'sam', name: 'Sam', role: 'service-owner' }],
        }),
      ),
    );
    const list = valueOf(await makeApi().demoUsers());
    expect(list).toHaveLength(1);
  });

  it('returns a failure (so no switch is shown) when the route does not exist', async () => {
    server.use(
      http.get(
        `${BASE}/demo-users`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    const r = await makeApi().demoUsers();
    expect(r.ok).toBe(false);
  });
});
