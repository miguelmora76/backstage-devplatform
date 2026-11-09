import { expect, test } from '@playwright/test';
import { client, signIn } from './support/api';
import { seededDependencies, seededFailedRuns } from './support/seed';
import { waitForHealthyStack } from './support/healthy';
import { containerId, killContainer, startService } from './support/stack';
import { openService, switchUser } from './support/ui';

// NFR4.1: the flows of FR1 to FR4 in Chrome and Firefox: view the plan,
// propose an upgrade, view failed runs, propose a re-run, approve, reject
// (a reason is required), retry a failed change, filter and page the audit
// log. Each browser uses its own service, so the two runs never meet.
/** The plugin backend reuses a health probe result for this long (BR7.1). */
const HEALTH_TTL_MS = 5000;

const SERVICE_OF: Record<string, string> = {
  chrome: 'profile-sync',
  firefox: 'catalog-portal',
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
  // Every browser spec starts from a stack that really answers (an earlier
  // spec may have ended the guardrails server).
  const request = await playwright.request.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:7007',
  });
  await waitForHealthyStack(request);
  await request.dispose();
});

test('the whole flow of plan, proposals, decisions, retry and audit', async ({
  page,
  request,
}, info) => {
  const service = SERVICE_OF[info.project.name];
  const upgradable = seededDependencies(service)
    .filter(d => d.currentVersion !== d.recommendedVersion)
    .map(d => d.name)
    .sort();
  const [first, second, third] = upgradable;
  const run = seededFailedRuns(service)[0];

  // View the plan and the failed runs as a service owner.
  await openService(page, 'sam', service);
  await expect(
    page.getByRole('cell', { name: first, exact: true }),
  ).toBeVisible();
  await expect(page.getByText('CI failure triage').first()).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: `Propose re-run for build ${run.runNumber}`,
    }),
  ).toBeVisible();

  // Propose an upgrade and a re-run.
  await page
    .getByRole('button', { name: `Propose change for ${first}` })
    .click();
  await expect(page.getByText('Change proposed.').first()).toBeVisible();
  await page
    .getByRole('button', { name: `Propose re-run for build ${run.runNumber}` })
    .click();
  await expect(page.getByText('Change proposed.').first()).toBeVisible();
  await expect(page.getByText('Open changes').first()).toBeVisible();

  // Approve the upgrade as another user; a reason is required.
  await switchUser(page, 'priya');
  await page
    .getByRole('link', { name: new RegExp(`^View change: Upgrade ${first} `) })
    .click();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Enter a reason.').first()).toBeVisible();
  await page.getByLabel('Reason (required)').fill('looks right');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(
    page.getByText('Change approved and applied.').first(),
  ).toBeVisible();

  // Reject the other change.
  await page.getByRole('link', { name: /^View change: Re-run/ }).click();
  await page.getByLabel('Reason (required)').fill('not now');
  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByText('Change rejected.').first()).toBeVisible();

  // A failed change, then a retry. FR3.6: an approval whose apply call gets
  // no answer from the server leaves the change failed. The plugin backend,
  // however, refuses a decision with 503 when its health probe says the server
  // is down, and it reuses a probe result for 5 seconds (serverHealth.ts). So
  // the state to build is: a probe that answered "reachable" a moment ago, then
  // the server ends, then the decision (all inside those 5 seconds).
  const sam = client(request, await signIn(request, 'sam'));
  const priya = client(request, await signIn(request, 'priya'));
  const server = containerId('guardrails-server');
  // Let any earlier probe result expire, so the next write probes afresh.
  await new Promise(resolve => setTimeout(resolve, HEALTH_TTL_MS + 500));
  const proposed = await sam.propose(
    service,
    'upgrade',
    seededDependencies(service).find(d => d.name === second)!.dependencyKey,
  );
  expect(proposed.status).toBe(201);
  const probedAt = Date.now();
  let failed;
  let gap = 0;
  try {
    killContainer(server);
    failed = await priya.decide(
      proposed.body.changeId,
      'approve',
      'server is down',
    );
    gap = Date.now() - probedAt;
  } finally {
    await startService('guardrails-server');
    await waitForHealthyStack(request);
  }
  expect(
    failed.body?.status,
    `approve while the server is down, ${gap} ms after the last probe (the plugin reuses a probe for ${HEALTH_TTL_MS} ms): HTTP ${failed.status}, body ${JSON.stringify(failed.body)}`,
  ).toBe('failed');
  await switchUser(page, 'sam');
  await switchUser(page, 'priya');
  await expect(page.getByText('Failed').first()).toBeVisible();
  await page
    .getByRole('link', { name: new RegExp(`^View change: Upgrade ${second} `) })
    .click();
  await page.getByLabel('Reason (required)').fill('server is back');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Retry applied.').first()).toBeVisible();

  // Fill the audit log past one page, then filter and page it.
  const target = seededDependencies(service).find(
    d => d.name === third,
  )!.dependencyKey;
  for (let i = 0; i < 8; i += 1) {
    const p = await sam.propose(service, 'upgrade', target);
    expect(p.status).toBe(201);
    await priya.decide(p.body.changeId, 'reject', `round ${i}`);
  }
  await switchUser(page, 'sam');
  await switchUser(page, 'priya');
  await expect(page.getByText(/Page 1 of [2-9]/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).last().click();
  await expect(page.getByText(/Page 2 of/).first()).toBeVisible();
  const audit = page.getByRole('region', { name: 'Audit log' });
  await audit
    .getByLabel('Action', { exact: true })
    .selectOption({ label: 'Reject' });
  await expect(audit.getByText('Page 1 of 1')).toBeVisible();
  await audit.getByRole('button', { name: 'Clear filters' }).click();
  await expect(audit.getByText(/Page 1 of [2-9]/)).toBeVisible();
});
