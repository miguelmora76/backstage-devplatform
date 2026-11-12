import { parse } from 'yaml';

export interface SettingsFiles {
  /** Text of `app-config.yaml`. */
  appConfig: string;
  /** Text of `app-config.postgres.yaml`. */
  postgresConfig: string;
  /** Text of `.env.example`. */
  envExample: string;
}

export interface SettingsFinding {
  rule: string;
  message: string;
}

const POSTGRES_KEYS = ['host', 'port', 'database', 'user', 'password'] as const;
const POSTGRES_VARIABLES: Record<(typeof POSTGRES_KEYS)[number], string> = {
  host: 'POSTGRES_HOST',
  port: 'POSTGRES_PORT',
  database: 'POSTGRES_DB',
  user: 'POSTGRES_USER',
  password: 'POSTGRES_PASSWORD',
};
const CORE_ENV_NAMES = [
  'GUARDRAILS_SERVER_URL',
  'GUARDRAILS_DEMO_SIGN_IN',
  'APP_BASE_URL',
  'BACKEND_BASE_URL',
  'BACKEND_PORT',
];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SECRET_KEY = /(pass(word)?|secret|token|credential)/i;

type Json = unknown;

function get(root: Json, path: string): Json {
  let node = root;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') {
      return undefined;
    }
    node = (node as Record<string, Json>)[part];
  }
  return node;
}

/** Every `[dotted key, string value]` pair in a parsed settings file. */
function stringEntries(node: Json, prefix = ''): Array<[string, string]> {
  if (typeof node === 'string') {
    return [[prefix, node]];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item, i) => stringEntries(item, `${prefix}[${i}]`));
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      stringEntries(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

/** Host names found in the addresses of a string, ignoring `${...}` names. */
function hostsIn(text: string): string[] {
  const hosts: string[] = [];
  for (const match of text.matchAll(/https?:\/\/([^\s/:'",}]+)/g)) {
    hosts.push(match[1]);
  }
  return hosts;
}

function parseOrEmpty(text: string): Json {
  try {
    return parse(text) ?? {};
  } catch {
    return {};
  }
}

/**
 * The one check of the committed settings (NFR2.5, NFR5.1, NFR5.2, NFR5.4,
 * NFR5.6, security design S9). The settings test and the CI script both call
 * it, so they cannot disagree. An empty result means the files pass.
 */
export function checkShippedSettings(files: SettingsFiles): SettingsFinding[] {
  const findings: SettingsFinding[] = [];
  const add = (rule: string, message: string) =>
    findings.push({ rule, message });

  const app = parseOrEmpty(files.appConfig);
  const postgres = parseOrEmpty(files.postgresConfig);

  // NFR5.1: the demo provider is the only sign-in.
  const providers = get(app, 'auth.providers');
  const providerNames =
    providers && typeof providers === 'object' ? Object.keys(providers) : [];
  if (providerNames.length !== 1 || providerNames[0] !== 'demo') {
    add(
      'only-demo-provider',
      `auth.providers must hold only "demo" (found: ${providerNames.join(', ') || 'none'}).`,
    );
  }

  // NFR5.4 / BR4.1: the server address has no default and is not written.
  if (get(app, 'guardrails.server.url') !== '${GUARDRAILS_SERVER_URL}') {
    add(
      'server-url-substitution',
      'guardrails.server.url must be exactly ${GUARDRAILS_SERVER_URL}, with no default.',
    );
  }

  // NFR5.2 / BR4.2: the demo switch comes from the environment, off by default.
  if (
    get(app, 'guardrails.demoSignIn.enabled') !==
    '${GUARDRAILS_DEMO_SIGN_IN:-false}'
  ) {
    add(
      'demo-switch-default-off',
      'guardrails.demoSignIn.enabled must be ${GUARDRAILS_DEMO_SIGN_IN:-false}.',
    );
  }

  // NFR5.4 / BR4.4: no literal secret and no foreign host in any file.
  for (const [label, document] of [
    ['app-config.yaml', app],
    ['app-config.postgres.yaml', postgres],
  ] as const) {
    for (const [key, value] of stringEntries(document)) {
      const last = key.split('.').pop() ?? key;
      if (SECRET_KEY.test(last) && !/^\$\{[A-Z0-9_]+\}$/.test(value)) {
        add(
          'no-literal-secret',
          `${label}: ${key} holds a literal value; secrets come from the environment.`,
        );
      }
      for (const host of hostsIn(value)) {
        if (!LOCAL_HOSTS.has(host) && !host.startsWith('$')) {
          add(
            'no-foreign-host',
            `${label}: ${key} names the host ${host}; only the app's own local addresses are allowed.`,
          );
        }
      }
    }
  }
  for (const host of hostsIn(files.envExample)) {
    if (!LOCAL_HOSTS.has(host)) {
      add('no-foreign-host', `.env.example names the host ${host}.`);
    }
  }

  // NFR5.6: one CORS origin, no wildcard.
  const origin = get(app, 'backend.cors.origin');
  if (typeof origin !== 'string' || origin.includes('*') || origin === '') {
    add(
      'cors-single-origin',
      'backend.cors.origin must be the app address only, without a wildcard.',
    );
  }

  // Security design S9: a content policy exists, with no wildcard and no eval.
  // Backstage's own pages evaluate scripts (the entity page fails with an
  // EvalError otherwise, seen in a real browser run), so 'unsafe-eval' is
  // allowed for script-src only; script-src must still include 'self'.
  const csp = get(app, 'backend.csp');
  const directives =
    csp && typeof csp === 'object'
      ? Object.entries(csp as Record<string, Json>)
      : [];
  const scriptSrc = get(csp, 'script-src');
  const badValue = directives.some(([directive, values]) =>
    [values].flat().some(
      value =>
        // `upgrade-insecure-requests: false` switches that directive off
        // (checked separately below); every other value must be a string.
        (directive !== 'upgrade-insecure-requests' ||
          typeof value !== 'boolean') &&
        (typeof value !== 'string' ||
          value.includes('*') ||
          (value.includes('unsafe-eval') && directive !== 'script-src')),
    ),
  );
  if (
    directives.length === 0 ||
    badValue ||
    !Array.isArray(scriptSrc) ||
    !scriptSrc.includes("'self'")
  ) {
    add(
      'content-policy',
      "backend.csp must be present, with no wildcard host, script-src including 'self', and unsafe-eval only in script-src.",
    );
  }

  // Safari rewrites every http://localhost request to https when the policy
  // carries `upgrade-insecure-requests` (Backstage's default), which leaves
  // the page blank. The shipped policy must switch that directive off.
  if (get(csp, 'upgrade-insecure-requests') !== false) {
    add(
      'csp-no-upgrade',
      'backend.csp must set upgrade-insecure-requests: false, or Safari cannot load the app from a local http address.',
    );
  }

  // The PostgreSQL file: five required substitutions and nothing else.
  const connection = get(postgres, 'backend.database.connection');
  for (const key of POSTGRES_KEYS) {
    const expected = `\${${POSTGRES_VARIABLES[key]}}`;
    if (get(connection, key) !== expected) {
      add(
        'postgres-substitutions',
        `app-config.postgres.yaml: ${key} must be exactly ${expected}.`,
      );
    }
  }

  // .env.example: names present, switch off, PostgreSQL only as comments.
  const envLines = files.envExample
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  const envValues = new Map(
    envLines.map(line => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)] as const;
    }),
  );
  for (const name of CORE_ENV_NAMES) {
    if (!envValues.has(name)) {
      add('env-example-names', `.env.example is missing ${name}.`);
    }
  }
  if (envValues.get('GUARDRAILS_DEMO_SIGN_IN') !== 'false') {
    add(
      'env-example-demo-off',
      '.env.example must ship GUARDRAILS_DEMO_SIGN_IN=false (contract C3).',
    );
  }
  for (const name of envValues.keys()) {
    if (name.startsWith('POSTGRES_') || SECRET_KEY.test(name)) {
      add(
        'env-example-postgres',
        `.env.example sets ${name}; PostgreSQL variables and secrets are not set here.`,
      );
    }
  }

  return findings;
}
