import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  DemoSession,
  STORAGE_KEY,
  type SessionStorageLike,
} from './demoSession';
import type { DemoUser } from './types';
import { ok, fail } from './failures';

const START = 'http://backend.test/api/auth/demo/start';
const USERS: DemoUser[] = [
  { userId: 'sam', name: 'Sam', role: 'service-owner' },
  { userId: 'priya', name: 'Priya', role: 'platform-engineer' },
  { userId: 'alex', name: 'Alex', role: 'auditor' },
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  const storage: SessionStorageLike & { data: Record<string, string> } = {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: k => {
      delete data[k];
    },
  };
  return storage;
}

const startCalls: string[] = [];
function startHandler(status = 200, tokenFor = (id: string) => `tok-${id}`) {
  return http.get(START, ({ request }) => {
    const id = new URL(request.url).searchParams.get('userId') ?? '';
    startCalls.push(request.url);
    if (status !== 200) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'x' } },
        { status },
      );
    }
    return HttpResponse.json({
      profile: { displayName: id },
      providerInfo: {},
      backstageIdentity: { token: tokenFor(id), identity: { type: 'user' } },
    });
  });
}

function makeSession(
  storage: SessionStorageLike | undefined,
  users: 'ok' | 'off' = 'ok',
) {
  const order: string[] = [];
  const session = new DemoSession({
    discoveryApi: {
      getBaseUrl: async (id: string) => `http://backend.test/api/${id}`,
    },
    fetchApi: {
      fetch: (input, init) => {
        order.push('fetch');
        return fetch(input, init);
      },
    },
    storage,
  });
  session.setUsersLoader(async () => {
    order.push('users');
    return users === 'ok' ? ok(USERS) : fail({ kind: 'unknown', status: 404 });
  });
  return { session, order };
}

beforeEach(() => {
  startCalls.length = 0;
});

describe('DemoSession setup order (security design S1, S8)', () => {
  it('loads the user list first and asks for a token only for a stored id in that list', async () => {
    server.use(startHandler());
    const storage = memoryStorage({ [STORAGE_KEY]: 'priya' });
    const { session, order } = makeSession(storage);
    await session.ready;
    expect(order[0]).toBe('users');
    expect(startCalls).toHaveLength(1);
    expect(new URL(startCalls[0]).searchParams.get('userId')).toBe('priya');
    expect(session.chosenUserId()).toBe('priya');
    expect(await session.getToken()).toBe('tok-priya');
    expect(session.users()).toEqual(USERS);
  });

  it('drops a stored id that is not in the list and calls no start address', async () => {
    server.use(startHandler());
    const storage = memoryStorage({ [STORAGE_KEY]: 'mallory' });
    const { session } = makeSession(storage);
    await session.ready;
    expect(startCalls).toHaveLength(0);
    expect(session.chosenUserId()).toBeUndefined();
    expect(await session.getToken()).toBeUndefined();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('shows no switch and calls nothing when the demo list is unavailable', async () => {
    server.use(startHandler());
    const storage = memoryStorage({ [STORAGE_KEY]: 'sam' });
    const { session } = makeSession(storage, 'off');
    await session.ready;
    expect(session.users()).toBeUndefined();
    expect(startCalls).toHaveLength(0);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('keeps the app user when the stored user cannot get a token', async () => {
    server.use(startHandler(401));
    const { session } = makeSession(memoryStorage({ [STORAGE_KEY]: 'sam' }));
    await session.ready;
    expect(session.chosenUserId()).toBeUndefined();
    expect(await session.getToken()).toBeUndefined();
  });
});

describe('DemoSession select (BR5.2, BR5.4)', () => {
  it('asks the start address for the chosen user and keeps only the userId in storage', async () => {
    server.use(startHandler());
    const storage = memoryStorage();
    const { session } = makeSession(storage);
    await session.ready;
    expect(await session.select('alex')).toBe(true);
    expect(session.chosenUserId()).toBe('alex');
    expect(await session.getToken()).toBe('tok-alex');
    expect(JSON.stringify(storage.data)).toBe(
      JSON.stringify({ [STORAGE_KEY]: 'alex' }),
    );
    expect(JSON.stringify(storage.data)).not.toContain('tok-');
    // Only the userId travels in the start address.
    const url = new URL(startCalls[0]);
    expect([...url.searchParams.keys()]).toEqual(['userId']);
    expect(url.search).not.toContain('tok-');
  });

  it('never calls the start address for an id outside the list', async () => {
    server.use(startHandler());
    const { session } = makeSession(memoryStorage());
    await session.ready;
    expect(await session.select('mallory')).toBe(false);
    expect(startCalls).toHaveLength(0);
    expect(session.chosenUserId()).toBeUndefined();
  });

  it('keeps the previous user when the start address fails', async () => {
    server.use(startHandler());
    const { session } = makeSession(memoryStorage());
    await session.ready;
    await session.select('sam');
    server.use(startHandler(500));
    expect(await session.select('priya')).toBe(false);
    expect(session.chosenUserId()).toBe('sam');
    expect(await session.getToken()).toBe('tok-sam');
  });

  it('fails the switch when the answer carries no token', async () => {
    server.use(http.get(START, () => HttpResponse.json({ profile: {} })));
    const { session } = makeSession(memoryStorage());
    await session.ready;
    expect(await session.select('sam')).toBe(false);
    expect(session.chosenUserId()).toBeUndefined();
  });

  it('tells listeners when the chosen user changes', async () => {
    server.use(startHandler());
    const { session } = makeSession(memoryStorage());
    await session.ready;
    const seen: Array<string | undefined> = [];
    const off = session.subscribe(() => seen.push(session.chosenUserId()));
    await session.select('sam');
    await session.select('alex');
    off();
    await session.select('priya');
    expect(seen).toEqual(['sam', 'alex']);
  });
});

describe('DemoSession refresh and storage failures (NFR5.2)', () => {
  it('can refresh only while a demo user is chosen, and gets a new token', async () => {
    let n = 0;
    server.use(startHandler(200, id => `tok-${id}-${(n += 1)}`));
    const { session } = makeSession(memoryStorage());
    await session.ready;
    expect(session.canRefresh()).toBe(false);
    await session.select('sam');
    expect(session.canRefresh()).toBe(true);
    expect(await session.refresh()).toBe(true);
    expect(await session.getToken()).toBe('tok-sam-2');
  });

  it('shares one sign-in call between refreshes that run at the same time', async () => {
    server.use(startHandler());
    const { session } = makeSession(memoryStorage());
    await session.ready;
    await session.select('sam');
    startCalls.length = 0;
    const results = await Promise.all([
      session.refresh(),
      session.refresh(),
      session.refresh(),
    ]);
    expect(results).toEqual([true, true, true]);
    expect(startCalls).toHaveLength(1);
  });

  it('works for the life of the page when storage throws', async () => {
    server.use(startHandler());
    const broken: SessionStorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const { session } = makeSession(broken);
    await session.ready;
    expect(await session.select('priya')).toBe(true);
    expect(session.chosenUserId()).toBe('priya');
  });

  it('works when there is no storage at all', async () => {
    server.use(startHandler());
    const { session } = makeSession(undefined);
    await session.ready;
    expect(await session.select('sam')).toBe(true);
  });

  it('never writes a token to the console', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map(m =>
      jest.spyOn(console, m).mockImplementation(() => {}),
    );
    server.use(startHandler());
    const { session } = makeSession(memoryStorage());
    await session.ready;
    await session.select('sam');
    await session.refresh();
    for (const s of spies) {
      expect(s).not.toHaveBeenCalled();
      s.mockRestore();
    }
  });
});
