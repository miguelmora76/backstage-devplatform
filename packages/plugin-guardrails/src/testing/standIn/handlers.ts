import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  AllowedAction,
  AuditAction,
  AuditEntry,
  Change,
  ChangeKind,
  CiRunItem,
  DemoUser,
  ErrorCode,
  Outcome,
  PlanItem,
} from '../../api/types';

export const BACKEND = 'http://backend.test/api/guardrails';
export const AUTH = 'http://backend.test/api/auth';
export const SERVICE = 'payments-api';

export const SAM: DemoUser = {
  userId: 'sam',
  name: 'Sam',
  role: 'service-owner',
};
export const PRIYA: DemoUser = {
  userId: 'priya',
  name: 'Priya',
  role: 'platform-engineer',
};
export const ALEX: DemoUser = {
  userId: 'alex',
  name: 'Alex',
  role: 'auditor',
};

/** How one group of reads misbehaves. */
export type ReadMode = 'ok' | 'server-down' | 'error' | 'never' | 'network';

export interface Recorded {
  method: string;
  url: string;
  path: string;
  search: string;
  headers: Record<string, string>;
  body: unknown;
}

interface PlanBase {
  dependencyKey: string;
  name: string;
  currentVersion: string;
  recommendedVersion: string;
}
interface CiBase {
  runKey: string;
  runNumber: number;
  cause: string;
}

/**
 * The state of the stand-in backend. Tests change fields to reach every state
 * of the scan list. A contract test keeps its answers in step with
 * `c1-openapi.yaml` (NFR2.10).
 */
export interface StandInState {
  demoEnabled: boolean;
  users: DemoUser[];
  /** Who calls without a demo token: the app's own sign-in. */
  appUser: DemoUser;
  /** The guardrails server is down: plan and CI reads and all writes fail. */
  serverDown: boolean;
  plan: PlanBase[];
  ci: CiBase[];
  changes: Change[];
  audit: AuditEntry[];
  modes: {
    plan: ReadMode;
    ci: ReadMode;
    changes: ReadMode;
    audit: ReadMode;
    change: ReadMode;
    me: ReadMode;
    write: ReadMode;
  };
  /** Milliseconds every read waits before answering. */
  delayMs: number;
  /** What approve and retry do on the (stand-in) guardrails server. */
  applyOutcome: 'applied' | 'failed';
  /** Change ids that are being decided right now. */
  deciding: Set<string>;
  /** Make the next decision answer with this refusal, once. */
  nextDecisionError?: { status: number; code: ErrorCode };
  /** Start path answers this status instead of a token. */
  startStatus: number;
  requests: Recorded[];
  nextId: number;
}

const iso = (d: string) => `2026-11-0${d}Z`;

export function makeState(): StandInState {
  const state: StandInState = {
    demoEnabled: true,
    users: [SAM, PRIYA, ALEX],
    appUser: SAM,
    serverDown: false,
    plan: [
      {
        dependencyKey: 'lib-a',
        name: 'lib-a',
        currentVersion: '1.2',
        recommendedVersion: '2.0',
      },
      {
        dependencyKey: 'lib-b',
        name: 'lib-b',
        currentVersion: '3.1',
        recommendedVersion: '3.4',
      },
      {
        dependencyKey: 'lib-c',
        name: 'lib-c',
        currentVersion: '5.0',
        recommendedVersion: '5.0',
      },
    ],
    ci: [
      { runKey: 'run-41', runNumber: 41, cause: 'Flaky test' },
      { runKey: 'run-39', runNumber: 39, cause: 'Dependency conflict' },
    ],
    changes: [],
    audit: [],
    modes: {
      plan: 'ok',
      ci: 'ok',
      changes: 'ok',
      audit: 'ok',
      change: 'ok',
      me: 'ok',
      write: 'ok',
    },
    delayMs: 0,
    applyOutcome: 'applied',
    deciding: new Set(),
    startStatus: 200,
    requests: [],
    nextId: 3,
  };
  state.changes = [
    {
      changeId: 'c1',
      kind: 'upgrade',
      service: SERVICE,
      target: 'lib-a',
      summary: 'Upgrade lib-a from 1.2 to 2.0',
      proposedBy: SAM,
      status: 'pending',
      proposedAt: `${iso('6T10:40:00.000')}`,
      allowedActions: [],
    },
    {
      changeId: 'c2',
      kind: 'rerun',
      service: SERVICE,
      target: 'run-41',
      summary: 'Re-run CI run #41 (Flaky test)',
      proposedBy: SAM,
      status: 'failed',
      decidedBy: PRIYA,
      decisionReason: 'Looks safe',
      failureMessage: 'Runner pool unavailable',
      proposedAt: `${iso('6T10:30:00.000')}`,
      decidedAt: `${iso('6T10:35:00.000')}`,
      allowedActions: [],
    },
  ];
  state.audit = Array.from({ length: 25 }, (_, i) => {
    const n = 25 - i;
    const actions: Array<[AuditAction, Outcome, string | undefined]> = [
      ['propose', 'proposed', undefined],
      ['approve', 'applied', 'Safe, tested.'],
      ['reject', 'rejected', 'Not now'],
    ];
    const [action, outcome, reason] = actions[n % 3];
    const entry: AuditEntry = {
      entryId: `e${n}`,
      time: `2026-11-06T${String(10 + Math.floor(n / 6)).padStart(2, '0')}:${String((n * 7) % 60).padStart(2, '0')}:00.000Z`,
      actor: n % 2 === 0 ? PRIYA : SAM,
      action,
      service: SERVICE,
      target: n % 2 === 0 ? 'lib-a' : 'lib-b',
      outcome,
      changeId: 'c1',
    };
    if (reason) entry.reason = reason;
    return entry;
  });
  return state;
}

function userFromAuth(state: StandInState, header: string | null): DemoUser {
  const m = /^Bearer token-(\w+)$/.exec(header ?? '');
  return state.users.find(u => u.userId === m?.[1]) ?? state.appUser;
}

function errorBody(code: ErrorCode, message = 'A fixed message.') {
  return { error: { code, message } };
}

function allowedFor(
  state: StandInState,
  user: DemoUser,
  base: { proposedBy?: DemoUser; status?: Change['status']; id?: string },
  actions: AllowedAction['action'][],
  already?: boolean,
): AllowedAction[] {
  return actions.map(action => {
    let reason: string | undefined;
    if (state.serverDown) reason = 'SERVER_UNREACHABLE';
    else if (user.role === 'auditor') reason = 'AUDITOR_READ_ONLY';
    else if (action !== 'propose' && base.proposedBy?.userId === user.userId)
      reason = 'PROPOSER_CANNOT_DECIDE';
    else if (action !== 'propose' && base.id && state.deciding.has(base.id))
      reason = 'IN_PROGRESS';
    else if (
      (action === 'approve' || action === 'reject') &&
      base.status !== 'pending'
    )
      reason = 'NOT_PENDING';
    else if (action === 'retry' && base.status !== 'failed')
      reason = 'NOT_FAILED';
    else if (action === 'propose' && already) reason = 'ALREADY_CURRENT';
    return reason
      ? { action, allowed: false, reason }
      : { action, allowed: true };
  });
}

function withActions(state: StandInState, user: DemoUser, c: Change): Change {
  return {
    ...c,
    allowedActions: allowedFor(
      state,
      user,
      { proposedBy: c.proposedBy, status: c.status, id: c.changeId },
      ['approve', 'reject', 'retry'],
    ),
  };
}

/** The msw handlers for C1 and the demo sign-in start path. */
export function createHandlers(state: StandInState): HttpHandler[] {
  const record = async (request: Request) => {
    const url = new URL(request.url);
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => {
      headers[k] = v;
    });
    let body: unknown;
    if (request.method !== 'GET') {
      try {
        body = await request.clone().json();
      } catch {
        body = undefined;
      }
    }
    state.requests.push({
      method: request.method,
      url: request.url,
      path: url.pathname,
      search: url.search,
      headers,
      body,
    });
  };

  const gate = async (mode: ReadMode): Promise<Response | undefined> => {
    if (mode === 'never') return new Promise<Response>(() => {});
    if (state.delayMs > 0) {
      await new Promise(r => setTimeout(r, state.delayMs));
    }
    if (mode === 'network') return HttpResponse.error();
    if (mode === 'error')
      return HttpResponse.json(errorBody('INTERNAL_ERROR'), { status: 500 });
    if (mode === 'server-down')
      return HttpResponse.json(errorBody('SERVER_UNREACHABLE'), {
        status: 503,
      });
    return undefined;
  };

  const readMode = (
    key: Exclude<keyof StandInState['modes'], 'write'>,
    serverRead = false,
  ): ReadMode => {
    const m = state.modes[key];
    if (m !== 'ok') return m;
    return serverRead && state.serverDown ? 'server-down' : 'ok';
  };

  const ownChange = (id: string) => state.changes.find(c => c.changeId === id);

  const addAudit = (
    actor: DemoUser,
    action: AuditAction,
    outcome: Outcome,
    target: string,
    reason: string | undefined,
    changeId: string | undefined,
  ) => {
    const entry: AuditEntry = {
      entryId: `e${state.audit.length + 100}`,
      time: '2026-11-07T09:00:00.000Z',
      actor,
      action,
      service: SERVICE,
      target,
      outcome,
    };
    if (reason !== undefined) entry.reason = reason;
    if (changeId) entry.changeId = changeId;
    state.audit.unshift(entry);
  };

  const decide = async (
    request: Request,
    id: string,
    action: 'approve' | 'reject' | 'retry',
  ): Promise<Response> => {
    await record(request);
    const early = await gate(state.modes.write);
    if (early) return early;
    const user = userFromAuth(state, request.headers.get('authorization'));
    const body = (await request
      .clone()
      .json()
      .catch(() => ({}))) as {
      reason?: string;
    };
    const reason = body.reason ?? '';
    const change = ownChange(id);
    if (!change)
      return HttpResponse.json(errorBody('NOT_FOUND'), { status: 404 });
    if (state.nextDecisionError) {
      const e = state.nextDecisionError;
      state.nextDecisionError = undefined;
      return HttpResponse.json(errorBody(e.code), { status: e.status });
    }
    if (state.serverDown)
      return HttpResponse.json(errorBody('SERVER_UNREACHABLE'), {
        status: 503,
      });
    if (reason.trim().length === 0)
      return HttpResponse.json(errorBody('EMPTY_REASON'), { status: 400 });
    if (reason.length > 2000)
      return HttpResponse.json(errorBody('INVALID_INPUT'), { status: 400 });
    if (user.role === 'auditor') {
      addAudit(user, action, 'refused', change.target, reason, change.changeId);
      return HttpResponse.json(errorBody('AUDITOR_READ_ONLY'), {
        status: 403,
      });
    }
    if (change.proposedBy.userId === user.userId) {
      addAudit(user, action, 'refused', change.target, reason, change.changeId);
      return HttpResponse.json(errorBody('SELF_DECISION'), { status: 403 });
    }
    if (action === 'retry' && change.status !== 'failed') {
      addAudit(user, action, 'refused', change.target, reason, change.changeId);
      return HttpResponse.json(errorBody('NOT_FAILED'), { status: 409 });
    }
    if (action !== 'retry' && change.status !== 'pending') {
      addAudit(user, action, 'refused', change.target, reason, change.changeId);
      return HttpResponse.json(errorBody('ALREADY_DECIDED'), { status: 409 });
    }
    let outcome: Outcome;
    if (action === 'reject') {
      change.status = 'rejected';
      outcome = 'rejected';
    } else if (state.applyOutcome === 'applied') {
      change.status = 'applied';
      change.failureMessage = undefined;
      outcome = 'applied';
    } else {
      change.status = 'failed';
      change.failureMessage = 'Runner pool unavailable';
      outcome = 'failed';
    }
    change.decidedBy = user;
    change.decisionReason = reason;
    change.decidedAt = '2026-11-07T09:00:00.000Z';
    addAudit(user, action, outcome, change.target, reason, change.changeId);
    return HttpResponse.json(withActions(state, user, change));
  };

  return [
    http.get(`${AUTH}/demo/start`, async ({ request }) => {
      await record(request);
      const id = new URL(request.url).searchParams.get('userId') ?? '';
      const user = state.users.find(u => u.userId === id);
      if (state.startStatus !== 200 || !user) {
        return HttpResponse.json(errorBody('UNAUTHENTICATED'), {
          status: state.startStatus !== 200 ? state.startStatus : 401,
        });
      }
      return HttpResponse.json({
        profile: { displayName: user.name },
        providerInfo: {},
        backstageIdentity: {
          token: `token-${user.userId}`,
          identity: { type: 'user', userEntityRef: `user:default/${id}` },
        },
      });
    }),

    http.get(`${BACKEND}/demo-users`, async ({ request }) => {
      await record(request);
      if (!state.demoEnabled) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json({ items: state.users });
    }),

    http.get(`${BACKEND}/me`, async ({ request }) => {
      await record(request);
      const early = await gate(readMode('me'));
      if (early) return early;
      return HttpResponse.json(
        userFromAuth(state, request.headers.get('authorization')),
      );
    }),

    http.get(`${BACKEND}/services/:service/plan`, async ({ request }) => {
      await record(request);
      const early = await gate(readMode('plan', true));
      if (early) return early;
      const user = userFromAuth(state, request.headers.get('authorization'));
      const items: PlanItem[] = state.plan.map(p => ({
        ...p,
        allowedActions: allowedFor(
          state,
          user,
          {},
          ['propose'],
          p.currentVersion === p.recommendedVersion,
        ),
      }));
      return HttpResponse.json({ service: SERVICE, items });
    }),

    http.get(`${BACKEND}/services/:service/ci-runs`, async ({ request }) => {
      await record(request);
      const early = await gate(readMode('ci', true));
      if (early) return early;
      const user = userFromAuth(state, request.headers.get('authorization'));
      const items: CiRunItem[] = state.ci.map(r => ({
        ...r,
        status: 'failed',
        allowedActions: allowedFor(state, user, {}, ['propose']),
      }));
      return HttpResponse.json({ service: SERVICE, items });
    }),

    http.get(`${BACKEND}/services/:service/changes`, async ({ request }) => {
      await record(request);
      const early = await gate(readMode('changes'));
      if (early) return early;
      const user = userFromAuth(state, request.headers.get('authorization'));
      const items = state.changes
        .filter(c => c.status === 'pending' || c.status === 'failed')
        .sort((a, b) => b.proposedAt.localeCompare(a.proposedAt))
        .slice(0, 200)
        .map(c => withActions(state, user, c));
      return HttpResponse.json({ service: SERVICE, items });
    }),

    http.post(`${BACKEND}/services/:service/changes`, async ({ request }) => {
      await record(request);
      const early = await gate(state.modes.write);
      if (early) return early;
      const user = userFromAuth(state, request.headers.get('authorization'));
      const body = (await request
        .clone()
        .json()
        .catch(() => ({}))) as {
        kind?: ChangeKind;
        target?: string;
      };
      if (
        (body.kind !== 'upgrade' && body.kind !== 'rerun') ||
        !body.target ||
        body.target.length > 200
      ) {
        return HttpResponse.json(errorBody('INVALID_INPUT'), { status: 400 });
      }
      if (state.serverDown)
        return HttpResponse.json(errorBody('SERVER_UNREACHABLE'), {
          status: 503,
        });
      if (user.role === 'auditor') {
        addAudit(user, 'propose', 'refused', body.target, undefined, undefined);
        return HttpResponse.json(errorBody('AUDITOR_READ_ONLY'), {
          status: 403,
        });
      }
      let summary: string;
      if (body.kind === 'upgrade') {
        const p = state.plan.find(x => x.dependencyKey === body.target);
        if (!p)
          return HttpResponse.json(errorBody('NOT_FOUND'), { status: 404 });
        if (p.currentVersion === p.recommendedVersion)
          return HttpResponse.json(errorBody('NOT_ELIGIBLE'), { status: 409 });
        summary = `Upgrade ${p.name} from ${p.currentVersion} to ${p.recommendedVersion}`;
      } else {
        const r = state.ci.find(x => x.runKey === body.target);
        if (!r)
          return HttpResponse.json(errorBody('NOT_FOUND'), { status: 404 });
        summary = `Re-run CI run #${r.runNumber} (${r.cause})`;
      }
      const change: Change = {
        changeId: `c${state.nextId++}`,
        kind: body.kind,
        service: SERVICE,
        target: body.target,
        summary,
        proposedBy: user,
        status: 'pending',
        proposedAt: '2026-11-07T08:00:00.000Z',
        allowedActions: [],
      };
      state.changes.push(change);
      addAudit(
        user,
        'propose',
        'proposed',
        body.target,
        undefined,
        change.changeId,
      );
      return HttpResponse.json(withActions(state, user, change), {
        status: 201,
      });
    }),

    http.get(`${BACKEND}/changes/:changeId`, async ({ request, params }) => {
      await record(request);
      const early = await gate(readMode('change'));
      if (early) return early;
      const user = userFromAuth(state, request.headers.get('authorization'));
      const change = ownChange(decodeURIComponent(String(params.changeId)));
      if (!change)
        return HttpResponse.json(errorBody('NOT_FOUND'), { status: 404 });
      return HttpResponse.json(withActions(state, user, change));
    }),

    http.post(`${BACKEND}/changes/:changeId/approve`, ({ request, params }) =>
      decide(request, decodeURIComponent(String(params.changeId)), 'approve'),
    ),
    http.post(`${BACKEND}/changes/:changeId/reject`, ({ request, params }) =>
      decide(request, decodeURIComponent(String(params.changeId)), 'reject'),
    ),
    http.post(`${BACKEND}/changes/:changeId/retry`, ({ request, params }) =>
      decide(request, decodeURIComponent(String(params.changeId)), 'retry'),
    ),

    http.get(`${BACKEND}/services/:service/audit`, async ({ request }) => {
      await record(request);
      const early = await gate(readMode('audit'));
      if (early) return early;
      const q = new URL(request.url).searchParams;
      const page = Number(q.get('page') ?? '1');
      const pageSize = Number(q.get('pageSize') ?? '20');
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100
      ) {
        return HttpResponse.json(errorBody('INVALID_INPUT'), { status: 400 });
      }
      const from = q.get('from');
      const to = q.get('to');
      const filtered = state.audit.filter(
        e =>
          (!from || e.time >= from) &&
          (!to || e.time <= to) &&
          (!q.get('actor') || e.actor.userId === q.get('actor')) &&
          (!q.get('action') || e.action === q.get('action')) &&
          (!q.get('outcome') || e.outcome === q.get('outcome')),
      );
      const items = filtered
        .slice()
        .sort((a, b) => b.time.localeCompare(a.time))
        .slice((page - 1) * pageSize, page * pageSize);
      return HttpResponse.json({
        items,
        page,
        pageSize,
        total: filtered.length,
      });
    }),
  ];
}
