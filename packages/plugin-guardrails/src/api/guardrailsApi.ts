import { fail, failureFrom, ok, type Failure, type Result } from './failures';
import type {
  AuditFilters,
  AuditPage,
  Change,
  ChangeKind,
  CiRunItem,
  DemoUser,
  PlanItem,
} from './types';

/** Time the page waits for a read before giving up (NFR1.4). */
export const READ_TIMEOUT_MS = 5000;
/** Time the page waits for a write: the backend's 10 s plus 2 s (NFR1.4). */
export const WRITE_TIMEOUT_MS = 12000;
/** Rows per audit page (D3). */
export const AUDIT_PAGE_SIZE = 10;

/**
 * The credential seam. `DemoSession` implements it. The token is read only
 * here, to build the one Authorization header (NFR5.3).
 */
export interface Credential {
  /** Bearer token of the chosen demo user, or undefined: use the app's own. */
  getToken(): Promise<string | undefined>;
  /** True only while a demo user is chosen; a refresh cannot help otherwise. */
  canRefresh(): boolean;
  /** Asks for a new token for the chosen user; true when one was obtained. */
  refresh(): Promise<boolean>;
}

export interface GuardrailsApiOptions {
  discoveryApi: { getBaseUrl(pluginId: string): Promise<string> };
  fetchApi: { fetch: typeof fetch };
  credential: Credential;
  readTimeoutMs?: number;
  writeTimeoutMs?: number;
}

export interface CallOptions {
  /** Lets a section stop a call it no longer wants (stale or unmounted). */
  signal?: AbortSignal;
}

type Json = Record<string, unknown>;

const enc = encodeURIComponent;

/**
 * The only code that makes calls to the plugin backend (security control S2,
 * S3, S5). One method per C1 call. It never throws: every outcome is a Result.
 * Request bodies have no field for an actor, a role or a user id (BR5.3).
 */
export class GuardrailsApi {
  private readonly discoveryApi: GuardrailsApiOptions['discoveryApi'];
  private readonly fetchApi: GuardrailsApiOptions['fetchApi'];
  private readonly credential: Credential;
  private readonly readTimeoutMs: number;
  private readonly writeTimeoutMs: number;

  constructor(options: GuardrailsApiOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
    this.credential = options.credential;
    this.readTimeoutMs = options.readTimeoutMs ?? READ_TIMEOUT_MS;
    this.writeTimeoutMs = options.writeTimeoutMs ?? WRITE_TIMEOUT_MS;
  }

  me(opts?: CallOptions): Promise<Result<DemoUser>> {
    return this.read<DemoUser>('/me', opts);
  }

  /**
   * The demo user list is an open route: it carries no credential, and it must
   * not wait for the session, which itself waits for this list.
   */
  async demoUsers(opts?: CallOptions): Promise<Result<DemoUser[]>> {
    const r = await this.attempt<{ items: DemoUser[] }>(
      'GET',
      '/demo-users',
      undefined,
      this.readTimeoutMs,
      opts,
      false,
    );
    return r.ok ? ok(r.value.items ?? []) : r;
  }

  async plan(service: string, opts?: CallOptions): Promise<Result<PlanItem[]>> {
    const r = await this.read<{ items: PlanItem[] }>(
      `/services/${enc(service)}/plan`,
      opts,
    );
    return r.ok ? ok(r.value.items ?? []) : r;
  }

  async ciRuns(
    service: string,
    opts?: CallOptions,
  ): Promise<Result<CiRunItem[]>> {
    const r = await this.read<{ items: CiRunItem[] }>(
      `/services/${enc(service)}/ci-runs`,
      opts,
    );
    return r.ok ? ok(r.value.items ?? []) : r;
  }

  /** The open changes (pending plus failed): the default of the C1 call. */
  async changes(
    service: string,
    opts?: CallOptions,
  ): Promise<Result<Change[]>> {
    const r = await this.read<{ items: Change[] }>(
      `/services/${enc(service)}/changes`,
      opts,
    );
    return r.ok ? ok(r.value.items ?? []) : r;
  }

  change(changeId: string, opts?: CallOptions): Promise<Result<Change>> {
    return this.read<Change>(`/changes/${enc(changeId)}`, opts);
  }

  async audit(
    service: string,
    filters: AuditFilters,
    page: number,
    opts?: CallOptions,
  ): Promise<Result<AuditPage>> {
    const query = new URLSearchParams();
    if (filters.from) query.set('from', filters.from);
    if (filters.to) query.set('to', filters.to);
    if (filters.actor) query.set('actor', filters.actor);
    if (filters.action) query.set('action', filters.action);
    if (filters.outcome) query.set('outcome', filters.outcome);
    query.set('page', String(page));
    query.set('pageSize', String(AUDIT_PAGE_SIZE));
    return this.read<AuditPage>(
      `/services/${enc(service)}/audit?${query.toString()}`,
      opts,
    );
  }

  propose(
    service: string,
    kind: ChangeKind,
    target: string,
    opts?: CallOptions,
  ): Promise<Result<Change>> {
    return this.write<Change>(
      `/services/${enc(service)}/changes`,
      { kind, target },
      opts,
    );
  }

  approve(changeId: string, reason: string, opts?: CallOptions) {
    return this.decide(changeId, 'approve', reason, opts);
  }

  reject(changeId: string, reason: string, opts?: CallOptions) {
    return this.decide(changeId, 'reject', reason, opts);
  }

  retry(changeId: string, reason: string, opts?: CallOptions) {
    return this.decide(changeId, 'retry', reason, opts);
  }

  private decide(
    changeId: string,
    action: 'approve' | 'reject' | 'retry',
    reason: string,
    opts?: CallOptions,
  ): Promise<Result<Change>> {
    // The reason is sent exactly as typed; the only field is `reason`.
    return this.write<Change>(
      `/changes/${enc(changeId)}/${action}`,
      { reason },
      opts,
    );
  }

  private read<T>(path: string, opts?: CallOptions): Promise<Result<T>> {
    return this.send<T>('GET', path, undefined, this.readTimeoutMs, opts);
  }

  private write<T>(
    path: string,
    body: Json,
    opts?: CallOptions,
  ): Promise<Result<T>> {
    return this.send<T>('POST', path, body, this.writeTimeoutMs, opts);
  }

  private async send<T>(
    method: 'GET' | 'POST',
    path: string,
    body: Json | undefined,
    timeoutMs: number,
    opts?: CallOptions,
  ): Promise<Result<T>> {
    const first = await this.attempt<T>(method, path, body, timeoutMs, opts);
    if (
      first.ok ||
      first.failure.kind !== 'unauthenticated' ||
      !this.credential.canRefresh()
    ) {
      return first;
    }
    // One refresh. A read is repeated once; a write is never repeated on its
    // own (security design S1): the person sees the text and tries again.
    const refreshed = await this.credential.refresh().catch(() => false);
    if (!refreshed || method !== 'GET') {
      return first;
    }
    return this.attempt<T>(method, path, body, timeoutMs, opts);
  }

  private async attempt<T>(
    method: 'GET' | 'POST',
    path: string,
    body: Json | undefined,
    timeoutMs: number,
    opts?: CallOptions,
    authenticated = true,
  ): Promise<Result<T>> {
    let baseUrl: string;
    let token: string | undefined;
    try {
      baseUrl = await this.discoveryApi.getBaseUrl('guardrails');
      token = authenticated ? await this.credential.getToken() : undefined;
    } catch {
      return fail({ kind: 'no-answer' });
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    if (opts?.signal?.aborted) {
      return fail({ kind: 'no-answer' });
    }
    opts?.signal?.addEventListener('abort', onCallerAbort);
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await this.fetchApi.fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      return await this.parse<T>(res);
    } catch {
      // Lost connection, abort or timeout: all the same case for the screens.
      return fail({ kind: 'no-answer' });
    } finally {
      clearTimeout(timer);
      opts?.signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  private async parse<T>(res: Response): Promise<Result<T>> {
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      json = undefined;
    }
    if (res.ok) {
      return json === undefined
        ? fail({ kind: 'unknown', status: res.status })
        : ok(json as T);
    }
    const code = (json as { error?: { code?: unknown } } | undefined)?.error
      ?.code;
    const failure: Failure = failureFrom(res.status, code);
    return fail(failure);
  }
}
