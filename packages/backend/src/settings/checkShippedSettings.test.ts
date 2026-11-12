import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkShippedSettings,
  type SettingsFiles,
} from './checkShippedSettings';

const backendDir = join(__dirname, '..', '..');
const repoRoot = join(backendDir, '..', '..');

function shipped(): SettingsFiles {
  return {
    appConfig: readFileSync(join(backendDir, 'app-config.yaml'), 'utf8'),
    postgresConfig: readFileSync(
      join(backendDir, 'app-config.postgres.yaml'),
      'utf8',
    ),
    envExample: readFileSync(join(repoRoot, '.env.example'), 'utf8'),
  };
}

function rules(files: SettingsFiles): string[] {
  return checkShippedSettings(files).map(finding => finding.rule);
}

describe('checkShippedSettings', () => {
  it('finds nothing wrong with the shipped files (NFR2.5)', () => {
    expect(checkShippedSettings(shipped())).toEqual([]);
  });

  it('fails when a second sign-in provider is configured (NFR5.1)', () => {
    const files = shipped();
    files.appConfig = files.appConfig.replace(
      'demo: {}',
      'demo: {}\n    github: {}',
    );
    expect(rules(files)).toContain('only-demo-provider');
  });

  it('fails when the server address is written or has a default (NFR5.4)', () => {
    const files = shipped();
    files.appConfig = files.appConfig.replace(
      'url: ${GUARDRAILS_SERVER_URL}',
      'url: ${GUARDRAILS_SERVER_URL:-http://localhost:7100}',
    );
    expect(rules(files)).toContain('server-url-substitution');
  });

  it('fails when the demo switch is not read from the environment with the default false (NFR5.2)', () => {
    const files = shipped();
    files.appConfig = files.appConfig.replace(
      'enabled: ${GUARDRAILS_DEMO_SIGN_IN:-false}',
      'enabled: true',
    );
    expect(rules(files)).toContain('demo-switch-default-off');
  });

  it('fails on a literal password, secret or foreign host name (NFR5.4)', () => {
    const files = shipped();
    files.postgresConfig = files.postgresConfig.replace(
      'password: ${POSTGRES_PASSWORD}',
      'password: hunter2',
    );
    expect(rules(files)).toEqual(
      expect.arrayContaining(['no-literal-secret', 'postgres-substitutions']),
    );

    const foreign = shipped();
    foreign.appConfig = foreign.appConfig.replace(
      'baseUrl: ${BACKEND_BASE_URL:-http://localhost:7007}',
      'baseUrl: https://example.com',
    );
    expect(rules(foreign)).toContain('no-foreign-host');
  });

  it('fails when CORS allows a wildcard or no origin (NFR5.6)', () => {
    const wildcard = shipped();
    wildcard.appConfig = wildcard.appConfig.replace(
      'origin: ${APP_BASE_URL:-http://localhost:3000}',
      "origin: '*'",
    );
    expect(rules(wildcard)).toContain('cors-single-origin');
  });

  it('fails when the content policy is missing, has a wildcard or allows eval (security design S9)', () => {
    const missing = shipped();
    missing.appConfig = missing.appConfig.replace(
      / {2}csp:[\s\S]*?script-src:[^\n]*\n/,
      '',
    );
    expect(rules(missing)).toContain('content-policy');

    // Backstage's own pages need script evaluation (observed in a real
    // browser run, see code-summary.md), so 'unsafe-eval' is allowed for
    // scripts only, never for any other directive.
    const evalElsewhere = shipped();
    evalElsewhere.appConfig = evalElsewhere.appConfig.replace(
      `script-src: ["'self'", "'unsafe-eval'"]`,
      `script-src: ["'self'", "'unsafe-eval'"]\n    style-src: ["'self'", "'unsafe-eval'"]`,
    );
    expect(rules(evalElsewhere)).toContain('content-policy');

    const noSelf = shipped();
    noSelf.appConfig = noSelf.appConfig.replace(
      `script-src: ["'self'", "'unsafe-eval'"]`,
      `script-src: ["'unsafe-eval'"]`,
    );
    expect(rules(noSelf)).toContain('content-policy');

    const star = shipped();
    star.appConfig = star.appConfig.replace(
      `script-src: ["'self'", "'unsafe-eval'"]`,
      `script-src: ["'self'", "'unsafe-eval'", '*']`,
    );
    expect(rules(star)).toContain('content-policy');
  });

  it('fails when the content policy still upgrades http requests, which leaves Safari blank on http://localhost', () => {
    const upgrading = shipped();
    upgrading.appConfig = upgrading.appConfig.replace(
      /^ {4}upgrade-insecure-requests: false\n/m,
      '',
    );
    expect(upgrading.appConfig).not.toContain('upgrade-insecure-requests');
    expect(rules(upgrading)).toContain('csp-no-upgrade');
    expect(rules(shipped())).not.toContain('csp-no-upgrade');
    expect(rules(shipped())).not.toContain('content-policy');
  });

  it('checks .env.example: core names present, switch false, no password, PostgreSQL only as comments', () => {
    const missing = shipped();
    missing.envExample = missing.envExample.replace(/^BACKEND_PORT=.*$/m, '');
    expect(rules(missing)).toContain('env-example-names');

    const on = shipped();
    on.envExample = on.envExample.replace(
      'GUARDRAILS_DEMO_SIGN_IN=false',
      'GUARDRAILS_DEMO_SIGN_IN=true',
    );
    expect(rules(on)).toContain('env-example-demo-off');

    const password = shipped();
    password.envExample += '\nPOSTGRES_PASSWORD=secret\n';
    expect(rules(password)).toContain('env-example-postgres');
  });
});
