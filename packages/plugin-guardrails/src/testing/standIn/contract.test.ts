import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { setupServer } from 'msw/node';
import {
  ALEX,
  BACKEND,
  PRIYA,
  SERVICE,
  createHandlers,
  makeState,
  type StandInState,
} from './handlers';
import { responseSchema, templateFor, validate, type Spec } from './schema';

// Contract Ownership Rules: a stand-in that disagrees with the spec fails the
// consumer's test (NFR2.10). The spec belongs to u2.
const SPEC_FILE = path.resolve(
  __dirname,
  '../../../../plugin-guardrails-backend/contract/c1-openapi.yaml',
);
const spec = parse(fs.readFileSync(SPEC_FILE, 'utf8')) as Spec;

let state: StandInState;
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  state = makeState();
  server.resetHandlers(...createHandlers(state));
});
afterAll(() => server.close());

interface Case {
  name: string;
  method: 'GET' | 'POST';
  url: string;
  body?: unknown;
  as?: string;
  status: number;
  prepare?: (s: StandInState) => void;
}

const as = (u: { userId: string }) => `token-${u.userId}`;

const cases: Case[] = [
  { name: 'demo users', method: 'GET', url: '/demo-users', status: 200 },
  { name: 'me', method: 'GET', url: '/me', status: 200 },
  {
    name: 'plan',
    method: 'GET',
    url: `/services/${SERVICE}/plan`,
    status: 200,
  },
  {
    name: 'plan, server down',
    method: 'GET',
    url: `/services/${SERVICE}/plan`,
    status: 503,
    prepare: s => {
      s.serverDown = true;
    },
  },
  {
    name: 'ci',
    method: 'GET',
    url: `/services/${SERVICE}/ci-runs`,
    status: 200,
  },
  {
    name: 'ci, server down',
    method: 'GET',
    url: `/services/${SERVICE}/ci-runs`,
    status: 503,
    prepare: s => {
      s.serverDown = true;
    },
  },
  {
    name: 'changes',
    method: 'GET',
    url: `/services/${SERVICE}/changes`,
    status: 200,
  },
  {
    name: 'changes as auditor',
    method: 'GET',
    url: `/services/${SERVICE}/changes`,
    as: as(ALEX),
    status: 200,
  },
  {
    name: 'propose upgrade',
    method: 'POST',
    url: `/services/${SERVICE}/changes`,
    body: { kind: 'upgrade', target: 'lib-a' },
    as: as(PRIYA),
    status: 201,
  },
  {
    name: 'propose rerun',
    method: 'POST',
    url: `/services/${SERVICE}/changes`,
    body: { kind: 'rerun', target: 'run-41' },
    as: as(PRIYA),
    status: 201,
  },
  {
    name: 'propose, invalid',
    method: 'POST',
    url: `/services/${SERVICE}/changes`,
    body: { kind: 'nope' },
    status: 400,
  },
  {
    name: 'propose, auditor',
    method: 'POST',
    url: `/services/${SERVICE}/changes`,
    body: { kind: 'upgrade', target: 'lib-a' },
    as: as(ALEX),
    status: 403,
  },
  {
    name: 'propose, unknown target',
    method: 'POST',
    url: `/services/${SERVICE}/changes`,
    body: { kind: 'upgrade', target: 'nope' },
    status: 404,
  },
  {
    name: 'propose, not eligible',
    method: 'POST',
    url: `/services/${SERVICE}/changes`,
    body: { kind: 'upgrade', target: 'lib-c' },
    status: 409,
  },
  {
    name: 'propose, server down',
    method: 'POST',
    url: `/services/${SERVICE}/changes`,
    body: { kind: 'upgrade', target: 'lib-a' },
    status: 503,
    prepare: s => {
      s.serverDown = true;
    },
  },
  { name: 'change', method: 'GET', url: '/changes/c1', status: 200 },
  { name: 'change, not found', method: 'GET', url: '/changes/zz', status: 404 },
  {
    name: 'approve',
    method: 'POST',
    url: '/changes/c1/approve',
    body: { reason: 'Safe' },
    as: as(PRIYA),
    status: 200,
  },
  {
    name: 'approve, applied failed',
    method: 'POST',
    url: '/changes/c1/approve',
    body: { reason: 'Safe' },
    as: as(PRIYA),
    status: 200,
    prepare: s => {
      s.applyOutcome = 'failed';
    },
  },
  {
    name: 'approve, own change',
    method: 'POST',
    url: '/changes/c1/approve',
    body: { reason: 'Safe' },
    status: 403,
  },
  {
    name: 'approve, auditor',
    method: 'POST',
    url: '/changes/c1/approve',
    body: { reason: 'Safe' },
    as: as(ALEX),
    status: 403,
  },
  {
    name: 'approve, empty reason',
    method: 'POST',
    url: '/changes/c1/approve',
    body: { reason: '   ' },
    as: as(PRIYA),
    status: 400,
  },
  {
    name: 'approve, not found',
    method: 'POST',
    url: '/changes/zz/approve',
    body: { reason: 'x' },
    as: as(PRIYA),
    status: 404,
  },
  {
    name: 'approve, already decided',
    method: 'POST',
    url: '/changes/c1/approve',
    body: { reason: 'x' },
    as: as(PRIYA),
    status: 409,
    prepare: s => {
      s.changes[0].status = 'rejected';
    },
  },
  {
    name: 'approve, server down',
    method: 'POST',
    url: '/changes/c1/approve',
    body: { reason: 'x' },
    as: as(PRIYA),
    status: 503,
    prepare: s => {
      s.serverDown = true;
    },
  },
  {
    name: 'reject',
    method: 'POST',
    url: '/changes/c1/reject',
    body: { reason: 'No' },
    as: as(PRIYA),
    status: 200,
  },
  {
    name: 'reject, already decided',
    method: 'POST',
    url: '/changes/c1/reject',
    body: { reason: 'No' },
    as: as(PRIYA),
    status: 409,
    prepare: s => {
      s.changes[0].status = 'applied';
    },
  },
  {
    name: 'retry',
    method: 'POST',
    url: '/changes/c2/retry',
    body: { reason: 'Again' },
    as: as(PRIYA),
    status: 200,
    prepare: s => {
      s.changes[1].proposedBy = s.users[0];
    },
  },
  {
    name: 'retry, not failed',
    method: 'POST',
    url: '/changes/c1/retry',
    body: { reason: 'Again' },
    as: as(PRIYA),
    status: 409,
  },
  {
    name: 'audit',
    method: 'GET',
    url: `/services/${SERVICE}/audit?page=1&pageSize=10`,
    status: 200,
  },
  {
    name: 'audit, bad page size',
    method: 'GET',
    url: `/services/${SERVICE}/audit?pageSize=500`,
    status: 400,
  },
];

describe('stand-in backend against c1-openapi.yaml (NFR2.10)', () => {
  it.each(cases)('$name answers $status as the spec declares', async c => {
    c.prepare?.(state);
    const res = await fetch(`${BACKEND}${c.url}`, {
      method: c.method,
      headers: {
        ...(c.as ? { authorization: `Bearer ${c.as}` } : {}),
        ...(c.body ? { 'content-type': 'application/json' } : {}),
      },
      body: c.body ? JSON.stringify(c.body) : undefined,
    });
    expect(res.status).toBe(c.status);
    const pathname = new URL(res.url || `${BACKEND}${c.url}`).pathname.replace(
      /^\/api\/guardrails/,
      '',
    );
    const template = templateFor(spec, pathname);
    expect(template).toBeDefined();
    const declared = responseSchema(spec, template!, c.method, res.status);
    expect(declared.declared).toBe(true);
    expect(declared.schema).toBeDefined();
    const body = await res.json();
    expect(validate(spec, declared.schema!, body)).toEqual([]);
  });

  it('detects an answer that differs from the spec', () => {
    const schema = { $ref: '#/components/schemas/DemoUser' };
    expect(
      validate(spec, schema, {
        userId: 'sam',
        name: 'Sam',
        role: 'service-owner',
      }),
    ).toEqual([]);
    expect(
      validate(spec, schema, { userId: 'sam', name: 'Sam', role: 'admin' }),
    ).not.toEqual([]);
    expect(
      validate(spec, schema, {
        userId: 'sam',
        name: 'Sam',
        role: 'auditor',
        extra: 1,
      }),
    ).not.toEqual([]);
    expect(
      validate(spec, schema, { userId: 'sam', role: 'auditor' }),
    ).not.toEqual([]);
  });

  it('exercises every route and method of the spec', () => {
    const tested = new Set<string>();
    for (const c of cases) {
      const pathname = c.url.split('?')[0];
      tested.add(`${c.method} ${templateFor(spec, pathname)}`);
    }
    const wanted = new Set<string>();
    for (const [template, ops] of Object.entries(spec.paths)) {
      for (const method of Object.keys(ops)) {
        wanted.add(`${method.toUpperCase()} ${template}`);
      }
    }
    expect([...wanted].filter(w => !tested.has(w))).toEqual([]);
  });
});
