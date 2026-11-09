import type { Credential } from './guardrailsApi';
import type { Result } from './failures';
import type { DemoUser } from './types';

/** The one value kept in tab storage: the chosen userId (NFR5.2). */
export const STORAGE_KEY = 'guardrails.demoUser';

/** The path of the demo sign-in start route (contract C3), relative. */
export const START_PATH = '/demo/start';

const START_TIMEOUT_MS = 5000;

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DemoSessionOptions {
  discoveryApi: { getBaseUrl(pluginId: string): Promise<string> };
  fetchApi: { fetch: typeof fetch };
  /** Tab storage. Defaults to the browser's session storage when present. */
  storage?: SessionStorageLike;
}

type UsersLoader = () => Promise<Result<DemoUser[]>>;

function browserStorage(): SessionStorageLike | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Holds the chosen demo user and the user's token (security control S1).
 * The token lives in a private field of this object only: it is never stored,
 * logged, rendered or placed in an address, and no method returns it except
 * `getToken`, which only `GuardrailsApi` calls (S2). The only value written
 * to tab storage is the userId.
 */
export class DemoSession implements Credential {
  readonly ready: Promise<void>;

  private resolveReady!: () => void;
  private readonly discoveryApi: DemoSessionOptions['discoveryApi'];
  private readonly fetchApi: DemoSessionOptions['fetchApi'];
  private readonly storage: SessionStorageLike | undefined;
  private usersLoader?: UsersLoader;
  private demoUsers?: DemoUser[];
  private chosen?: string;
  private token?: string;
  private refreshing?: Promise<boolean>;
  private readonly listeners = new Set<() => void>();

  constructor(options: DemoSessionOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
    this.storage = options.storage ?? browserStorage();
    this.ready = new Promise<void>(resolve => {
      this.resolveReady = resolve;
    });
  }

  /**
   * Wires the user list loader and starts the setup. The loader belongs to
   * `GuardrailsApi`; it is injected to avoid a cycle.
   */
  setUsersLoader(loader: UsersLoader): void {
    this.usersLoader = loader;
    void this.setup();
  }

  /** The list of demo users, or undefined when the demo sign-in is off. */
  users(): DemoUser[] | undefined {
    return this.demoUsers;
  }

  chosenUserId(): string | undefined {
    return this.chosen;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async getToken(): Promise<string | undefined> {
    await this.ready;
    return this.token;
  }

  canRefresh(): boolean {
    return this.chosen !== undefined;
  }

  /** Several calls that meet a 401 together share one sign-in call. */
  refresh(): Promise<boolean> {
    if (!this.chosen) {
      return Promise.resolve(false);
    }
    if (!this.refreshing) {
      const userId = this.chosen;
      this.refreshing = this.fetchToken(userId)
        .then(token => {
          if (!token) {
            return false;
          }
          this.token = token;
          return true;
        })
        .finally(() => {
          this.refreshing = undefined;
        });
    }
    return this.refreshing;
  }

  /** Switches to a user from the list. Returns false and changes nothing on any problem. */
  async select(userId: string): Promise<boolean> {
    await this.ready;
    if (!this.demoUsers?.some(u => u.userId === userId)) {
      return false;
    }
    const token = await this.fetchToken(userId);
    if (!token) {
      return false;
    }
    this.chosen = userId;
    this.token = token;
    this.write(userId);
    this.listeners.forEach(l => l());
    return true;
  }

  private async setup(): Promise<void> {
    try {
      const stored = this.read();
      const list = await this.usersLoader!();
      if (!list.ok) {
        // Demo sign-in off: no switch, no start call, nothing remembered.
        this.demoUsers = undefined;
        this.write(undefined);
        return;
      }
      this.demoUsers = list.value;
      if (stored && list.value.some(u => u.userId === stored)) {
        const token = await this.fetchToken(stored);
        if (token) {
          this.chosen = stored;
          this.token = token;
          return;
        }
      }
      if (stored) {
        this.write(undefined);
      }
    } finally {
      this.resolveReady();
    }
  }

  private async fetchToken(userId: string): Promise<string | undefined> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), START_TIMEOUT_MS);
    try {
      const base = await this.discoveryApi.getBaseUrl('auth');
      const query = new URLSearchParams({ userId });
      const res = await this.fetchApi.fetch(
        `${base}${START_PATH}?${query.toString()}`,
        { method: 'GET', signal: controller.signal },
      );
      if (!res.ok) {
        return undefined;
      }
      const json = (await res.json()) as {
        backstageIdentity?: { token?: unknown };
      };
      const token = json?.backstageIdentity?.token;
      return typeof token === 'string' && token.length > 0 ? token : undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  private read(): string | undefined {
    try {
      return this.storage?.getItem(STORAGE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private write(userId: string | undefined): void {
    try {
      if (userId === undefined) {
        this.storage?.removeItem(STORAGE_KEY);
      } else {
        this.storage?.setItem(STORAGE_KEY, userId);
      }
    } catch {
      // Storage blocked: the choice lasts for the life of the page.
    }
  }
}
