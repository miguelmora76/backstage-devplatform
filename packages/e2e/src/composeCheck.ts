import { findLiteralSecrets } from './secretCheck';
import { SEED } from './envFile';

/**
 * The writable paths and limits of the design (infrastructure specification,
 * "Resource sizing"). The compose-file test compares the real file with these
 * numbers; a change after a real run is made here and in compose.yaml
 * together, so it can never widen silently (NFR5.3).
 */
export const COMPOSE_LIMITS = {
  app: {
    mem: '1g',
    pids: 256,
    tmpfs: [
      '/tmp:size=64m',
      '/app/node_modules/app/dist/static:size=64m,uid=1000,gid=1000,mode=0755',
    ],
  },
  'guardrails-server': { mem: '256m', pids: 128, tmpfs: undefined },
  postgres: {
    mem: '512m',
    pids: 128,
    tmpfs: ['/tmp:size=64m', '/var/run/postgresql:size=8m'],
  },
};

type Json = Record<string, any>;

const EXACT_TAG = /^[\w./-]+:\d+\.\d+(\.\d+)?(-[\w.]+)?$/;

function environmentOf(service: Json): Record<string, string> {
  const env = service.environment;
  if (Array.isArray(env)) {
    return Object.fromEntries(
      env.map((line: string) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
    );
  }
  return env ?? {};
}

function isNonRoot(user: unknown): boolean {
  if (typeof user !== 'string') return false;
  const [id] = user.split(':');
  if (id === 'postgres' || id === 'node') return true;
  return /^\d+$/.test(id) && Number(id) !== 0;
}

/** Checks a parsed compose file against NFR2.3, NFR5.1 to NFR5.5 and NFR7.1. */
export function checkCompose(doc: unknown): string[] {
  const root = doc as Json | null;
  const services: Json = root?.services ?? {};
  if (!root || Object.keys(services).length === 0) {
    return ['NFR2.3: the file has no services.'];
  }
  const problems: string[] = [];

  // NFR5.1: one published port, on the loopback address only.
  const ports = Object.values(services).flatMap(s => s.ports ?? []) as string[];
  if (ports.length !== 1) {
    problems.push(
      `NFR5.1: the file must publish exactly one port, found ${ports.length}.`,
    );
  }
  for (const port of ports) {
    if (!String(port).startsWith('127.0.0.1:')) {
      problems.push(`NFR5.1: port ${port} is not bound to 127.0.0.1.`);
    }
  }
  if (root.networks?.internal?.internal !== true) {
    problems.push(
      'NFR5.1: the internal network must be marked internal: true.',
    );
  }

  for (const [name, service] of Object.entries<Json>(services)) {
    if (!isNonRoot(service.user)) {
      problems.push(`NFR5.3: service ${name} must set a non-root user.`);
    }
    if (JSON.stringify(service.cap_drop) !== '["ALL"]') {
      problems.push(`NFR5.3: service ${name} must have cap_drop: [ALL].`);
    }
    if (JSON.stringify(service.security_opt) !== '["no-new-privileges:true"]') {
      problems.push(`NFR5.3: service ${name} must set no-new-privileges.`);
    }
    if (service.read_only !== true) {
      problems.push(`NFR5.3: service ${name} must be read_only: true.`);
    }
    if (service.restart !== 'no') {
      problems.push(`NFR2.7: service ${name} must have restart: "no".`);
    }
    if (!service.healthcheck?.test) {
      problems.push(`NFR2.3: service ${name} needs a health check.`);
    }
    if (typeof service.image === 'string' && !EXACT_TAG.test(service.image)) {
      problems.push(
        `NFR5.4: service ${name} uses ${service.image}, which is not an exact version tag.`,
      );
    }
  }

  // Writable paths and limits as designed (NFR5.3).
  for (const [name, limits] of Object.entries(COMPOSE_LIMITS)) {
    const service = services[name];
    if (!service) {
      problems.push(`NFR2.3: service ${name} is missing.`);
      continue;
    }
    if (JSON.stringify(service.tmpfs) !== JSON.stringify(limits.tmpfs)) {
      problems.push(
        `NFR5.3: service ${name} has a writable set that differs from the written list.`,
      );
    }
    if (name === 'guardrails-server' && service.volumes) {
      problems.push(`NFR5.3: service ${name} must have no writable volume.`);
    }
    if (
      service.mem_limit !== limits.mem ||
      service.pids_limit !== limits.pids
    ) {
      problems.push(
        `NFR5.3: service ${name} limits differ from the written numbers.`,
      );
    }
  }

  const app = services.app;
  if (app) {
    const wants = ['guardrails-server', 'postgres'];
    const dep = app.depends_on;
    const ok =
      dep &&
      !Array.isArray(dep) &&
      wants.every(w => dep[w]?.condition === 'service_healthy');
    if (!ok) {
      problems.push(
        'NFR2.7: app depends_on must wait for guardrails-server and postgres to be service_healthy.',
      );
    }
    const env = environmentOf(app);
    if (env.APP_BASE_URL !== env.BACKEND_BASE_URL) {
      problems.push('NFR2.3: the app base addresses must be equal.');
    }
    if (String(env.GUARDRAILS_DEMO_SIGN_IN) !== 'true') {
      problems.push(
        'NFR5.5: the app must set GUARDRAILS_DEMO_SIGN_IN to true.',
      );
    }
  }

  const server = services['guardrails-server'];
  if (server && String(environmentOf(server).GUARDRAILS_SEED) !== SEED) {
    problems.push(`NFR7.1: the server seed must be the literal ${SEED}.`);
  }

  const db = services.postgres;
  if (db) {
    const volume = (db.volumes ?? [])[0]?.split(':')[0];
    if (!volume || !root.volumes || !(volume in root.volumes)) {
      problems.push(
        'NFR2.3: postgres needs a named volume declared at the top.',
      );
    }
  }

  problems.push(...findLiteralSecrets(root));
  return problems;
}
