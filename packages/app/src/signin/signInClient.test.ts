import {
  createRequestGuard,
  createSignInClient,
  SIGN_IN_TIMEOUT_MS,
} from './signInClient';

const discovery = {
  getBaseUrl: async (pluginId: string) => `http://backend.test/api/${pluginId}`,
};

function reply(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const usersBody = {
  items: [
    { userId: 'sam', name: 'Sam', role: 'service-owner' },
    { userId: 'priya', name: 'Priya', role: 'platform-engineer' },
    { userId: 'alex', name: 'Alex', role: 'auditor' },
  ],
};

/** A fetch that never answers but rejects when it is aborted, like the real one. */
function hangingFetch(): typeof fetch {
  return ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      );
    })) as unknown as typeof fetch;
}

describe('signInClient', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads the open user list (BR2.2)', async () => {
    const fetchFn = jest.fn(async (_url: string) => reply(200, usersBody));
    const client = createSignInClient({
      discovery,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(client.listUsers()).resolves.toEqual({
      status: 'ok',
      users: usersBody.items,
    });
    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://backend.test/api/guardrails/demo-users',
    );
  });

  it('reports the demo sign-in as off on 401 or 404 (BR2.2)', async () => {
    for (const status of [401, 404]) {
      const client = createSignInClient({
        discovery,
        fetchFn: (async () => reply(status)) as unknown as typeof fetch,
      });
      await expect(client.listUsers()).resolves.toEqual({ status: 'off' });
    }
  });

  it('reports a failed list on a server error, a lost connection or an unreadable answer (NFR7.5)', async () => {
    const answers: Array<() => Promise<Response>> = [
      async () => reply(500),
      async () => {
        throw new TypeError('network');
      },
      async () => reply(200, { items: 'nope' }),
      async () => reply(200, { items: [{ userId: 1 }] }),
    ];
    for (const answer of answers) {
      const client = createSignInClient({
        discovery,
        fetchFn: answer as unknown as typeof fetch,
      });
      await expect(client.listUsers()).resolves.toEqual({ status: 'failed' });
    }
  });

  it('gives up on the list and on the start call after 5 seconds (NFR1.1)', async () => {
    jest.useFakeTimers();
    const client = createSignInClient({ discovery, fetchFn: hangingFetch() });

    const list = client.listUsers();
    await jest.advanceTimersByTimeAsync(SIGN_IN_TIMEOUT_MS - 1);
    let settled = false;
    list.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(list).resolves.toEqual({ status: 'failed' });

    const start = client.start('sam');
    await jest.advanceTimersByTimeAsync(SIGN_IN_TIMEOUT_MS);
    await expect(start).resolves.toBeUndefined();
  });

  it('shows the users when the backend answers after 300 ms (NFR1.1)', async () => {
    jest.useFakeTimers();
    const fetchFn = (() =>
      new Promise(resolve =>
        setTimeout(() => resolve(reply(200, usersBody)), 300),
      )) as unknown as typeof fetch;
    const client = createSignInClient({ discovery, fetchFn });
    const list = client.listUsers();
    await jest.advanceTimersByTimeAsync(700);
    await expect(list).resolves.toMatchObject({ status: 'ok' });
  });

  it('asks the start address for the chosen user with the id encoded and returns the identity (BR2.3)', async () => {
    const answer = {
      profile: { displayName: 'Sam' },
      providerInfo: {},
      backstageIdentity: {
        token: 'fake-token',
        identity: {
          type: 'user',
          userEntityRef: 'user:default/sam',
          ownershipEntityRefs: ['user:default/sam'],
        },
      },
    };
    const fetchFn = jest.fn(async (_url: string) => reply(200, answer));
    const client = createSignInClient({
      discovery,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(client.start('sam')).resolves.toEqual(answer);
    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://backend.test/api/auth/demo/start?userId=sam',
    );
    await client.start('a b&c');
    expect(fetchFn.mock.calls[1][0]).toBe(
      'http://backend.test/api/auth/demo/start?userId=a%20b%26c',
    );
  });

  it('treats an error or an answer without a token as a failed start (BR2.3)', async () => {
    for (const answer of [
      async () => reply(401),
      async () => reply(200, { backstageIdentity: {} }),
      async () => {
        throw new TypeError('network');
      },
    ]) {
      const client = createSignInClient({
        discovery,
        fetchFn: answer as unknown as typeof fetch,
      });
      await expect(client.start('sam')).resolves.toBeUndefined();
    }
  });
});

describe('createRequestGuard', () => {
  it('drops the answer of an older request (NFR1.1)', () => {
    const guard = createRequestGuard();
    const first = guard.next();
    const second = guard.next();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });
});
