import { expect, test } from '@playwright/test';
import { bearer, client, signIn } from './support/api';
import {
  committedCatalog,
  seededDependencies,
  seededServices,
} from './support/seed';

// NFR7.1: the run shows the same data every time. NFR7.2: the changes and
// audit tables are empty after a reset, so this project runs first (the other
// projects depend on it) and `yarn e2e` is meant to start from
// `yarn compose:reset`.
test.describe.configure({ mode: 'serial' });

test('the catalog holds the ten committed entities', async ({ request }) => {
  const token = await signIn(request, 'sam');
  const response = await request.get('/api/catalog/entities', {
    headers: bearer(token),
  });
  expect(response.status()).toBe(200);
  const entities = (await response.json()) as Array<{
    kind: string;
    metadata: { name: string };
  }>;
  // Backstage adds one generated Location entity for the catalog file.
  const found = entities
    .filter(e => e.kind !== 'Location')
    .map(e => `${e.kind}:${e.metadata.name}`)
    .sort();
  const committed = committedCatalog()
    .map(e => `${e.kind}:${e.name}`)
    .sort();
  expect(committed).toHaveLength(10);
  expect(found).toEqual(committed);
});

test('every seeded service has the plan of the default data set (seed 20261106)', async ({
  request,
}) => {
  const api = client(request, await signIn(request, 'sam'));
  for (const service of seededServices()) {
    const { status, body } = await api.plan(service);
    expect(status, service).toBe(200);
    const got = (body.items as any[]).map(i => ({
      name: i.name,
      current: i.currentVersion,
      recommended: i.recommendedVersion,
    }));
    const want = seededDependencies(service)
      .map(d => ({
        name: d.name,
        current: d.currentVersion,
        recommended: d.recommendedVersion,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(got, service).toEqual(want);
  }
});

test('the same plan is returned byte for byte on two reads', async ({
  request,
}) => {
  const token = await signIn(request, 'sam');
  const url = '/api/guardrails/services/checkout-bridge/plan';
  const first = await (
    await request.get(url, { headers: bearer(token) })
  ).text();
  const second = await (
    await request.get(url, { headers: bearer(token) })
  ).text();
  expect(second).toBe(first);
});

test('the changes and audit lists of every seeded service are empty after a reset (NFR7.2)', async ({
  request,
}) => {
  const api = client(request, await signIn(request, 'sam'));
  for (const service of seededServices()) {
    const changes = await api.changes(service, 'open');
    expect(changes.body.items, `${service} changes`).toEqual([]);
    const audit = await api.audit(service);
    expect(audit.body.items, `${service} audit`).toEqual([]);
    expect(audit.body.total, `${service} audit total`).toBe(0);
  }
});
