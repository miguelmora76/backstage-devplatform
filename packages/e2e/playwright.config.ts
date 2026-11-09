import { defineConfig, devices } from '@playwright/test';

// The live checks (NFR3.1 to NFR3.3, NFR4.1, NFR5.6, NFR5.7, NFR5.10 to
// NFR5.12, NFR7.1, NFR7.2, NFR1.1). They run against the sample started by
// `yarn compose:up`, one worker, in the order of the projects below.
//
// Trace, video and HAR capture are off in every project (NFR5.10): only
// screenshots on failure and the text/JSON report are kept, so request
// headers and storage are never recorded.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:7007';
const viewport = { width: 1440, height: 900 };
const browserSpecs = /(flows|a11y|keyboard|tree)\.spec\.ts/;

export default defineConfig({
  testDir: 'specs',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  outputDir: 'dist/out/results',
  reporter: [
    ['list'],
    ['json', { outputFile: 'dist/out/report/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    viewport,
  },
  projects: [
    // Plain HTTP checks (no browser): they come first, so the "tables are
    // empty after a reset" check sees the state that `compose:reset` leaves.
    { name: 'repeatability', testMatch: /repeatability\.spec\.ts/ },
    {
      name: 'http',
      testMatch: /(headers-token|audit-append-only)\.spec\.ts/,
      dependencies: ['repeatability'],
    },
    {
      name: 'chrome',
      testMatch: browserSpecs,
      dependencies: ['http'],
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport },
    },
    {
      name: 'firefox',
      testMatch: browserSpecs,
      // After the http project, and (config order) after Chrome, so the two
      // browsers never overlap on stopping the guardrails server.
      dependencies: ['http'],
      use: { ...devices['Desktop Firefox'], viewport },
    },
    {
      name: 'timing',
      testMatch: /timing\.spec\.ts/,
      timeout: 600_000,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport },
    },
  ],
});
