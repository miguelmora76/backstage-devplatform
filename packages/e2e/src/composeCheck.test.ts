import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { checkCompose, COMPOSE_LIMITS } from './composeCheck';
import { repoRoot } from './repoRoot';
import { findLiteralSecrets } from './secretCheck';

const root = repoRoot();
const load = (...parts: string[]) =>
  parse(readFileSync(join(root, ...parts), 'utf8'));
const compose = () => load('compose.yaml');
const bad = () =>
  load('packages', 'e2e', 'src', 'testing', 'fixtures', 'compose-bad.yaml');

describe('compose.yaml (real file)', () => {
  it('breaks none of the rules', () => {
    expect(checkCompose(compose())).toEqual([]);
  });

  it('publishes exactly one port, on the loopback address (NFR5.1)', () => {
    const doc = compose();
    const ports = Object.values<any>(doc.services).flatMap(s => s.ports ?? []);
    expect(ports).toEqual(['127.0.0.1:7007:7007']);
    expect(doc.services.postgres.ports).toBeUndefined();
    expect(doc.services['guardrails-server'].ports).toBeUndefined();
    expect(doc.networks.internal.internal).toBe(true);
  });

  it('gives each service the fewest rights (NFR5.3)', () => {
    for (const [name, service] of Object.entries<any>(compose().services)) {
      expect([name, service.cap_drop]).toEqual([name, ['ALL']]);
      expect([name, service.security_opt]).toEqual([
        name,
        ['no-new-privileges:true'],
      ]);
      expect([name, service.restart]).toEqual([name, 'no']);
      expect(service.healthcheck?.test).toBeDefined();
      expect(service.read_only).toBe(true);
    }
  });

  it('makes the app wait for healthy server and database (NFR2.7)', () => {
    const app = compose().services.app;
    expect(app.depends_on).toEqual({
      'guardrails-server': { condition: 'service_healthy' },
      postgres: { condition: 'service_healthy' },
    });
  });

  it('keeps the writable paths and limits as designed', () => {
    const { services } = compose();
    expect(services.app.tmpfs).toEqual(COMPOSE_LIMITS.app.tmpfs);
    expect(services.postgres.tmpfs).toEqual(COMPOSE_LIMITS.postgres.tmpfs);
    expect(services['guardrails-server'].tmpfs).toBeUndefined();
    expect(services['guardrails-server'].volumes).toBeUndefined();
    for (const name of ['app', 'postgres', 'guardrails-server']) {
      expect([name, services[name].mem_limit]).toEqual([
        name,
        COMPOSE_LIMITS[name as 'app'].mem,
      ]);
      expect([name, services[name].pids_limit]).toEqual([
        name,
        COMPOSE_LIMITS[name as 'app'].pids,
      ]);
    }
  });

  it('sets the seed as a literal and the demo sign-in on (NFR7.1, NFR5.5)', () => {
    const { services } = compose();
    expect(services['guardrails-server'].environment.GUARDRAILS_SEED).toBe(
      '20261106',
    );
    expect(services.app.environment.GUARDRAILS_DEMO_SIGN_IN).toBe('true');
    expect(services.app.environment.GUARDRAILS_SERVER_URL).toBe(
      'http://guardrails-server:7007',
    );
  });

  it('keeps the two base addresses equal', () => {
    const env = compose().services.app.environment;
    expect(env.APP_BASE_URL).toBe(env.BACKEND_BASE_URL);
  });

  it('starts the app with the two settings files, so PostgreSQL is used', () => {
    const doc = compose();
    expect(doc.volumes).toHaveProperty('postgres-data');
    expect(doc.services.postgres.volumes).toEqual([
      'postgres-data:/var/lib/postgresql/data',
    ]);
  });

  it('holds no secret except as a substitution (NFR5.2)', () => {
    expect(findLiteralSecrets(compose())).toEqual([]);
    const text = readFileSync(join(root, 'compose.yaml'), 'utf8');
    expect(text).toContain('${POSTGRES_PASSWORD}');
  });

  it('pins the database image to an exact tag', () => {
    expect(compose().services.postgres.image).toMatch(
      /^postgres:16\.\d+(\.\d+)?-alpine3\.\d+$/,
    );
  });
});

describe('checkCompose (fixtures prove the rules fail)', () => {
  it('finds every deliberate fault in the bad fixture', () => {
    const found = checkCompose(bad()).join('\n');
    expect(found).toMatch(/NFR5\.1.*exactly one/);
    expect(found).toMatch(/NFR5\.1.*127\.0\.0\.1/);
    expect(found).toMatch(/NFR5\.1.*internal/);
    expect(found).toMatch(/NFR5\.3.*app.*user/);
    expect(found).toMatch(/NFR5\.3.*app.*cap_drop/);
    expect(found).toMatch(/NFR2\.3.*app.*health check/);
    expect(found).toMatch(/NFR2\.7.*app.*depends_on/);
    expect(found).toMatch(/NFR2\.3.*base addresses/);
    expect(found).toMatch(/NFR7\.1.*seed/);
    expect(found).toMatch(/NFR5\.4.*node:latest/);
    expect(found).toMatch(/NFR5\.4.*postgres:16/);
    expect(found).toMatch(/NFR5\.2/);
    expect(found).toMatch(/NFR2\.3.*named volume/);
  });

  it('finds a missing health check on its own', () => {
    const doc = compose();
    delete doc.services['guardrails-server'].healthcheck;
    expect(checkCompose(doc)).toEqual([
      expect.stringMatching(/guardrails-server.*health check/),
    ]);
  });

  it('finds a second published port on its own', () => {
    const doc = compose();
    doc.services.postgres.ports = ['127.0.0.1:5432:5432'];
    expect(checkCompose(doc)).toEqual([expect.stringMatching(/exactly one/)]);
  });

  it('finds a widened writable set on the server', () => {
    const doc = compose();
    doc.services['guardrails-server'].tmpfs = ['/data'];
    expect(checkCompose(doc).join()).toMatch(/guardrails-server.*writable/);
  });

  it('refuses a document that is not a compose file', () => {
    expect(checkCompose(null)).toEqual([expect.stringMatching(/services/)]);
    expect(checkCompose({ services: {} })).toEqual([
      expect.stringMatching(/services/),
    ]);
  });
});

describe('findLiteralSecrets', () => {
  it('allows substitutions and empty values', () => {
    expect(
      findLiteralSecrets({ env: { A_PASSWORD: '${X}', B_TOKEN: '', C: 'ok' } }),
    ).toEqual([]);
  });

  it('flags a literal password, token or key and a password in an address', () => {
    const found = findLiteralSecrets({
      env: { A_PASSWORD: 'abc', API_TOKEN: 'zzz' },
      url: 'postgresql://user:secretpw@host/db',
    });
    expect(found).toHaveLength(3);
    expect(found.join()).not.toContain('secretpw');
  });

  it('honours the named exemptions only', () => {
    const doc = { env: { POSTGRES_PASSWORD: 'postgres' } };
    expect(findLiteralSecrets(doc)).toHaveLength(1);
    expect(
      findLiteralSecrets(doc, [
        { key: 'POSTGRES_PASSWORD', value: 'postgres' },
      ]),
    ).toEqual([]);
    expect(
      findLiteralSecrets({ env: { POSTGRES_PASSWORD: 'other' } }, [
        { key: 'POSTGRES_PASSWORD', value: 'postgres' },
      ]),
    ).toHaveLength(1);
  });

  it('reads lists of KEY=value strings too', () => {
    expect(
      findLiteralSecrets({ environment: ['DB_PASSWORD=abc'] }),
    ).toHaveLength(1);
    expect(findLiteralSecrets({ environment: ['DB_PASSWORD=${P}'] })).toEqual(
      [],
    );
  });
});
