import type { DemoUser } from './signInState';

/** The page gives up on the user list and on the start call after this long (NFR1.1). */
export const SIGN_IN_TIMEOUT_MS = 5000;

/** What the demo provider's start address answers (functional spec D9). */
export interface StartAnswer {
  profile: { displayName?: string; email?: string; picture?: string };
  providerInfo: Record<string, unknown>;
  backstageIdentity: {
    token: string;
    identity: {
      type: 'user';
      userEntityRef: string;
      ownershipEntityRefs: string[];
    };
  };
}

export type ListResult =
  | { status: 'ok'; users: DemoUser[] }
  | { status: 'off' }
  | { status: 'failed' };

export interface SignInClientOptions {
  discovery: { getBaseUrl(pluginId: string): Promise<string> };
  fetchFn: typeof fetch;
  timeoutMs?: number;
}

export interface SignInClient {
  listUsers(): Promise<ListResult>;
  /** Asks the start address for a user; undefined means the start failed. */
  start(userId: string): Promise<StartAnswer | undefined>;
}

function isUser(value: unknown): value is DemoUser {
  const user = value as Partial<DemoUser> | null;
  return (
    typeof user?.userId === 'string' &&
    typeof user.name === 'string' &&
    typeof user.role === 'string'
  );
}

function parseStartAnswer(value: unknown): StartAnswer | undefined {
  const answer = value as Partial<StartAnswer> | null;
  const identity = answer?.backstageIdentity;
  if (
    typeof identity?.token !== 'string' ||
    identity.token === '' ||
    typeof identity.identity?.userEntityRef !== 'string'
  ) {
    return undefined;
  }
  return answer as StartAnswer;
}

/**
 * The two calls the sign-in page makes: the open user list and the start
 * address. Both give up after the timeout and report a limit like a lost
 * connection (performance design P1). Addresses come from the discovery
 * service, never from code (NFR5.4).
 */
export function createSignInClient(options: SignInClientOptions): SignInClient {
  const timeoutMs = options.timeoutMs ?? SIGN_IN_TIMEOUT_MS;

  async function timed(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await options.fetchFn(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async listUsers() {
      try {
        const base = await options.discovery.getBaseUrl('guardrails');
        const response = await timed(`${base}/demo-users`);
        if (response.status === 401 || response.status === 404) {
          return { status: 'off' };
        }
        if (!response.ok) {
          return { status: 'failed' };
        }
        const body = (await response.json()) as { items?: unknown };
        if (!Array.isArray(body.items) || !body.items.every(isUser)) {
          return { status: 'failed' };
        }
        return { status: 'ok', users: body.items };
      } catch {
        return { status: 'failed' };
      }
    },
    async start(userId) {
      try {
        const base = await options.discovery.getBaseUrl('auth');
        const response = await timed(
          `${base}/demo/start?userId=${encodeURIComponent(userId)}`,
        );
        if (!response.ok) {
          return undefined;
        }
        return parseStartAnswer(await response.json());
      } catch {
        return undefined;
      }
    },
  };
}

export interface RequestGuard {
  /** Starts a request and returns its number. */
  next(): number;
  /** True while no newer request has started. */
  isCurrent(request: number): boolean;
}

/** Drops the answer of a request that a newer one has replaced (performance design P2). */
export function createRequestGuard(): RequestGuard {
  const latest = { value: 0 };
  return {
    next: () => {
      latest.value += 1;
      return latest.value;
    },
    isCurrent: request => request === latest.value,
  };
}
