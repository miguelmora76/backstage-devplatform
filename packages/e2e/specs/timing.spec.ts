import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { percentile } from '../src/percentile';
import { prepareChanges, views } from './support/screens';

// NFR1.1: each view shows its data within 5 seconds on the compose sample.
// Every view is loaded 20 times, each in a fresh browser context (empty
// cache); a load is timed from navigation to the data-ready marker of the
// view. The 95th percentile (nearest rank: the 19th smallest of 20) must be at
// most 5000 ms, and the times are written to a JSON file the job uploads.
const LOADS = 20;
const LIMIT_MS = 5000;

test('the 95th percentile of 20 loads of each view is at most 5 seconds', async ({
  browser,
  playwright,
}, info) => {
  const request = await playwright.request.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:7007',
  });
  const prepared = await prepareChanges(request);
  await request.dispose();

  const report: Record<string, { samples: number[]; p95: number }> = {};
  for (const view of views(prepared)) {
    const samples: number[] = [];
    for (let i = 0; i < LOADS; i += 1) {
      const context = await browser.newContext({
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:7007',
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      const start = performance.now();
      await view.show(page);
      samples.push(Math.round(performance.now() - start));
      await context.close();
    }
    report[view.name] = { samples, p95: percentile(samples, 95, LOADS) };
    console.log(`${view.name}: p95 ${report[view.name].p95} ms`);
  }

  mkdirSync('dist/out/report', { recursive: true });
  writeFileSync(
    'dist/out/report/timing.json',
    JSON.stringify(
      { browser: browser.version(), limitMs: LIMIT_MS, loads: LOADS, report },
      null,
      2,
    ),
  );
  info.annotations.push({ type: 'browser', description: browser.version() });
  for (const [name, { p95 }] of Object.entries(report)) {
    expect(p95, `${name} p95`).toBeLessThanOrEqual(LIMIT_MS);
  }
});
