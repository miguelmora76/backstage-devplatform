import { expect, test } from '@playwright/test';
import { GUARDRAILS, bearer, client, signIn } from './support/api';
import { seededDependencies } from './support/seed';

// NFR5.11: the audit log stays append-only in the running sample. The plugin
// has one audit route, GET /services/:service/audit. A change is proposed by
// one user, its first entry is read, the change is approved by another user,
// and the first entry must be unchanged. PUT, PATCH and DELETE with a valid
// token (without one the answer is 401, which proves nothing about the route)
// to the route and to an entry address are answered 404 or 405, and the entry
// count before and after is equal.
const SERVICE = 'profile-sync';

test('the first audit entry is unchanged after the change is decided', async ({
  request,
}) => {
  const sam = client(request, await signIn(request, 'sam'));
  const priya = client(request, await signIn(request, 'priya'));
  const dependency = seededDependencies(SERVICE)
    .filter(d => d.currentVersion !== d.recommendedVersion)
    .sort((a, b) => b.name.localeCompare(a.name))[0];

  const proposed = await sam.propose(
    SERVICE,
    'upgrade',
    dependency.dependencyKey,
  );
  expect(proposed.status).toBe(201);
  const changeId = proposed.body.changeId as string;

  const before = await sam.audit(SERVICE);
  const first = (before.body.items as any[]).find(e => e.changeId === changeId);
  expect(first).toBeDefined();
  expect(first.outcome).toBe('proposed');

  const approved = await priya.decide(changeId, 'approve', 'append-only check');
  expect(approved.status).toBe(200);

  const after = await sam.audit(SERVICE);
  const same = (after.body.items as any[]).find(
    e => e.entryId === first.entryId,
  );
  expect(same).toEqual(first);
  expect(after.body.total).toBeGreaterThan(before.body.total);
});

test('write attempts on the audit route and on an entry are refused and change nothing', async ({
  request,
}) => {
  const token = await signIn(request, 'priya');
  const api = client(request, token);
  const before = await api.audit(SERVICE);
  expect(before.status).toBe(200);
  const entryId = (before.body.items as any[])[0]?.entryId ?? 'none';
  const addresses = [
    `${GUARDRAILS}/services/${SERVICE}/audit`,
    `${GUARDRAILS}/services/${SERVICE}/audit/${entryId}`,
  ];

  for (const url of addresses) {
    for (const method of ['PUT', 'PATCH', 'DELETE'] as const) {
      const response = await request.fetch(url, {
        method,
        headers: bearer(token),
        data: method === 'DELETE' ? undefined : { outcome: 'applied' },
      });
      expect([404, 405], `${method} ${url}`).toContain(response.status());
    }
  }

  const after = await api.audit(SERVICE);
  expect(after.body.total).toBe(before.body.total);
  expect(after.body.items).toEqual(before.body.items);
});
