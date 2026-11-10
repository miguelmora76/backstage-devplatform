import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import {
  minikubeDown,
  MiniDeps,
  minikubeUp,
  realMinikubeDeps,
} from './minikubeCommands';
import { PID_FILE } from './portForward';
import { repoRoot } from './repoRoot';
import { fakeOps, FakeWorld } from './testing/fakeOps';
import { fakeRunner, Rule } from './testing/fakeRunner';

function tempDir(): string {
  const base = join(repoRoot(), 'packages', 'e2e', 'dist', 'test-tmp');
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, 'mini-'));
}

const FORWARD_CMD =
  'kubectl --context minikube -n guardrails-sample port-forward --address 127.0.0.1 svc/app 7007:7007';
const NOT_FOUND = { status: 1, stderr: 'Error from server (NotFound)' };

interface Options {
  /** Is the profile running before `up` starts? */
  running?: boolean;
  context?: string;
  secretExists?: boolean;
  rolloutFails?: boolean;
  readyAnswers?: boolean[];
  world?: Partial<FakeWorld>;
  extra?: Rule[];
}

function setup(options: Options = {}) {
  const state = { running: options.running ?? false };
  const readyAnswers = options.readyAnswers ?? [true];
  const rules: Rule[] = [
    ...(options.extra ?? []),
    { when: ['docker', '--version'] },
    { when: ['minikube', 'version'] },
    { when: ['kubectl', 'version', '--client'] },
    {
      when: ['--profile', 'status'],
      result: () =>
        state.running
          ? { stdout: 'Running\n' }
          : { status: 7, stdout: 'Stopped\n' },
    },
    {
      when: ['--profile', 'start'],
      result: () => {
        state.running = true;
        return {};
      },
    },
    {
      when: ['kubectl', 'config', 'current-context'],
      result: { stdout: `${options.context ?? 'minikube'}\n` },
    },
    { when: ['--profile', 'image', 'build'] },
    { when: ['--profile', 'ssh', 'du'], result: { stdout: '400\n' } },
    {
      when: ['get', 'namespace'],
      result: { stdout: 'namespace/guardrails-sample' },
    },
    {
      when: ['get', 'secret'],
      result: options.secretExists
        ? { stdout: 'secret/guardrails-db' }
        : NOT_FOUND,
    },
    { when: ['get', 'pvc', 'postgres-data-postgres-0'], result: NOT_FOUND },
    { when: ['create', 'secret'] },
    { when: ['apply', '-k', 'k8s/'] },
    {
      when: ['rollout', 'status'],
      result: options.rolloutFails
        ? { status: 1, stderr: 'timed out waiting for the condition' }
        : {},
    },
    { when: ['get', 'pods,svc,pvc'], result: { stdout: 'PODS-TABLE\n' } },
    {
      when: ['get', 'pods', '-o', 'name'],
      result: { stdout: 'pod/app-1\npod/postgres-0\n' },
    },
    { when: ['describe', 'pods'], result: { stdout: 'DESCRIBE-TEXT\n' } },
    { when: ['logs'], result: { stdout: 'LOG-TEXT\n' } },
    { when: ['delete', 'namespace'] },
  ];
  const { run, calls, lines } = fakeRunner(rules);
  const { ops, world } = fakeOps(options.world);
  const logs: string[] = [];
  const clock = { t: 0 };
  const urls: string[] = [];
  const answers = [...readyAnswers];
  const deps: MiniDeps = {
    run,
    root: tempDir(),
    log: m => logs.push(m),
    ops,
    random: () => Buffer.alloc(16, 0xcd),
    now: () => clock.t,
    ready: async url => {
      urls.push(url);
      return answers.length > 1 ? answers.shift()! : answers[0];
    },
  };
  return { deps, calls, lines, logs, world, state, clock, urls };
}

const index = (lines: string[], needle: string, from = 0) =>
  lines.findIndex((l, i) => i >= from && l.includes(needle));

describe('minikubeUp (FR9.1, NFR2.19)', () => {
  it('stops first when a tool is missing, before anything else is touched', async () => {
    const { deps, lines } = setup({
      extra: [
        {
          when: ['minikube', 'version'],
          result: { status: null, error: 'ENOENT' },
        },
      ],
    });
    await expect(minikubeUp(deps)).rejects.toThrow(/minikube is not installed/);
    expect(lines().some(l => l.includes('start') || l.includes('apply'))).toBe(
      false,
    );
  });

  it('refuses a wrong context before any change when the profile already runs', async () => {
    const { deps, lines, world } = setup({ running: true, context: 'prod' });
    await expect(minikubeUp(deps)).rejects.toThrow(
      /"prod".*Nothing was changed/,
    );
    const text = lines().join('\n');
    expect(text).not.toMatch(/image build|apply|create|delete| start /);
    expect(world.spawned).toEqual([]);
  });

  it('starts a stopped cluster once, then guards the context, then builds', async () => {
    const { deps, lines } = setup({ running: false });
    await minikubeUp(deps);
    const starts = lines().filter(l => l.includes(' start '));
    expect(starts).toEqual([
      'minikube --profile minikube start --driver=docker --container-runtime=docker --cpus=2 --memory=4096',
    ]);
    const start = index(lines(), ' start ');
    const guard = index(lines(), 'config current-context', start);
    const build = index(lines(), 'image build');
    expect(start).toBeLessThan(guard);
    expect(guard).toBeLessThan(build);
  });

  it('guards twice when the cluster already runs, both before any change', async () => {
    const { deps, lines } = setup({ running: true });
    await minikubeUp(deps);
    const guards = lines()
      .map((l, i) => (l.includes('config current-context') ? i : -1))
      .filter(i => i >= 0);
    expect(guards).toHaveLength(2);
    expect(lines().some(l => l.includes(' start '))).toBe(false);
    expect(guards[1]).toBeLessThan(index(lines(), 'image build'));
  });

  it('runs images, namespace, Secret, apply, rollout wait, forward and readiness in that order', async () => {
    const { deps, lines, world, urls } = setup();
    await minikubeUp(deps);
    const order = [
      'image build -t guardrails-app:local',
      'image build -t guardrails-server:local',
      'du -sxm',
      'get namespace guardrails-sample',
      'get secret guardrails-db',
      'create secret generic guardrails-db',
      'apply -k k8s/',
      'rollout status statefulset/postgres',
      'rollout status deployment/guardrails-server',
      'rollout status deployment/app',
    ].map(n => index(lines(), n));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(world.spawned).toHaveLength(1);
    expect(urls).toEqual([
      'http://127.0.0.1:7007/.backstage/health/v1/readiness',
    ]);
  });

  it('creates the namespace when it is missing and bounds every wait by 300 seconds', async () => {
    const { deps, lines } = setup({
      extra: [
        { when: ['get', 'namespace'], result: NOT_FOUND },
        { when: ['create', 'namespace'] },
      ],
    });
    await minikubeUp(deps);
    expect(lines()).toContain(
      'kubectl --context minikube create namespace guardrails-sample',
    );
    expect(lines().filter(l => l.includes('rollout status'))).toEqual([
      'kubectl --context minikube -n guardrails-sample rollout status statefulset/postgres --timeout=300s',
      'kubectl --context minikube -n guardrails-sample rollout status deployment/guardrails-server --timeout=300s',
      'kubectl --context minikube -n guardrails-sample rollout status deployment/app --timeout=300s',
    ]);
  });

  it('prints the sample status, the description and each pod log, then fails naming the 300-second bound', async () => {
    const { deps, logs, lines } = setup({ rolloutFails: true });
    await expect(minikubeUp(deps)).rejects.toThrow(/300 seconds/);
    const text = logs.join('\n');
    expect(text).toContain('PODS-TABLE');
    expect(text).toContain('DESCRIBE-TEXT');
    expect(text).toContain('LOG-TEXT');
    expect(lines().filter(l => l.includes(' logs '))).toEqual([
      'kubectl --context minikube -n guardrails-sample logs pod/app-1 --all-containers=true --tail=200',
      'kubectl --context minikube -n guardrails-sample logs pod/postgres-0 --all-containers=true --tail=200',
    ]);
    expect(lines().some(l => l.includes('port-forward'))).toBe(false);
  });

  it('fails with the diagnosis when the readiness route never answers', async () => {
    const { deps, logs, clock } = setup({ readyAnswers: [false] });
    deps.ops.sleep = async ms => {
      clock.t += ms;
    };
    await expect(minikubeUp(deps)).rejects.toThrow(
      /readiness route.*300 seconds/s,
    );
    expect(logs.join('\n')).toContain('PODS-TABLE');
  });

  it('waits through a few not-ready answers before it succeeds', async () => {
    const { deps, logs, urls } = setup({ readyAnswers: [false, false, true] });
    await minikubeUp(deps);
    expect(urls).toHaveLength(3);
    expect(logs.join('\n')).toContain('http://localhost:7007');
  });

  it('a second up reuses the Secret and creates nothing new in it', async () => {
    const { deps, lines } = setup({ running: true, secretExists: true });
    await minikubeUp(deps);
    expect(lines().some(l => l.includes('create secret'))).toBe(false);
    expect(lines().some(l => l.includes('apply -k k8s/'))).toBe(true);
  });

  it('keeps the password out of every log line and call', async () => {
    const { deps, logs, lines } = setup();
    await minikubeUp(deps);
    const value = 'cd'.repeat(16);
    expect(logs.join('\n')).not.toContain(value);
    expect(lines().join('\n')).not.toContain(value);
  });

  it('stops when the app image is over the size limit', async () => {
    const { deps } = setup({
      extra: [
        { when: ['--profile', 'ssh', 'du'], result: { stdout: '551\n' } },
      ],
    });
    await expect(minikubeUp(deps)).rejects.toThrow(/551 MB.*550 MB/);
  });

  it('prints the time of each phase', async () => {
    const { deps, logs } = setup();
    await minikubeUp(deps);
    const phases = logs.filter(l => /^phase /.test(l)).join('\n');
    for (const name of [
      'tools',
      'cluster',
      'images',
      'apply',
      'rollout',
      'forward',
    ]) {
      expect(phases).toMatch(new RegExp(`phase ${name}: \\d+ s`));
    }
  });
});

describe('minikubeDown (NFR2.23, NFR5.22)', () => {
  it('stops the forward, then deletes the namespace, and says what is gone and what stays', async () => {
    const { deps, lines, logs, world } = setup({
      running: true,
      world: { table: new Map([[321, FORWARD_CMD]]) },
    });
    writeFileSync(join(deps.root, PID_FILE), '321\n');
    await minikubeDown(deps);
    expect(world.killed).toEqual([321]);
    expect(existsSync(join(deps.root, PID_FILE))).toBe(false);
    expect(lines().filter(l => l.includes('delete'))).toEqual([
      'kubectl --context minikube delete namespace guardrails-sample --ignore-not-found=true --wait=true --timeout=180s',
    ]);
    const text = logs.join('\n');
    expect(text).toMatch(/data .* gone/i);
    expect(text).toMatch(/cluster .* left running/i);
  });

  it('changes nothing on a wrong context', async () => {
    const { deps, lines, world } = setup({
      running: true,
      context: 'docker-desktop',
      world: { table: new Map([[321, FORWARD_CMD]]) },
    });
    writeFileSync(join(deps.root, PID_FILE), '321\n');
    await expect(minikubeDown(deps)).rejects.toThrow(/"docker-desktop"/);
    expect(world.killed).toEqual([]);
    expect(existsSync(join(deps.root, PID_FILE))).toBe(true);
    expect(lines().some(l => l.includes('delete'))).toBe(false);
  });

  it('only stops the forward when the cluster is not running', async () => {
    const { deps, lines, logs, world } = setup({
      running: false,
      world: { table: new Map([[321, FORWARD_CMD]]) },
    });
    writeFileSync(join(deps.root, PID_FILE), '321\n');
    await minikubeDown(deps);
    expect(world.killed).toEqual([321]);
    expect(lines().some(l => l.includes('delete'))).toBe(false);
    expect(logs.join('\n')).toMatch(/not running/i);
  });

  it('fails with the kubectl message when the namespace cannot be deleted', async () => {
    const { deps } = setup({
      running: true,
      extra: [
        {
          when: ['delete', 'namespace'],
          result: { status: 1, stderr: 'timed out' },
        },
      ],
    });
    await expect(minikubeDown(deps)).rejects.toThrow(
      /Could not delete.*timed out/,
    );
  });
});

describe('realMinikubeDeps', () => {
  it('asks a route and answers true only for a success status', async () => {
    const server = createServer((req, res) => {
      res.statusCode = req.url === '/ok' ? 200 : 503;
      res.end();
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    const deps = realMinikubeDeps('/repo', () => undefined);
    expect(await deps.ready(`http://127.0.0.1:${port}/ok`)).toBe(true);
    expect(await deps.ready(`http://127.0.0.1:${port}/not`)).toBe(false);
    await new Promise(resolve => server.close(resolve));
    expect(await deps.ready(`http://127.0.0.1:${port}/ok`)).toBe(false);
    expect(typeof deps.now()).toBe('number');
  });
});
