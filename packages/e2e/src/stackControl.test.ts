import { createStackControl, stackKind, StackDeps } from './stackControl';
import { fakeRunner, Rule } from './testing/fakeRunner';

const COMPOSE =
  'docker compose --project-name guardrails-sample --env-file .env.compose';
const KUBECTL = 'kubectl --context minikube -n guardrails-sample';

function deps(rules: Rule[]) {
  const { run, lines } = fakeRunner(rules);
  const clock = { t: 0 };
  const stackDeps: StackDeps = {
    run,
    root: '/repo',
    sleep: async ms => {
      clock.t += ms;
    },
    now: () => clock.t,
  };
  return { stackDeps, lines };
}

describe('stackKind (NFR2.24)', () => {
  it('defaults to compose and accepts the two names', () => {
    expect(stackKind(undefined)).toBe('compose');
    expect(stackKind('')).toBe('compose');
    expect(stackKind('compose')).toBe('compose');
    expect(stackKind('minikube')).toBe('minikube');
  });

  it('refuses any other value with a plain message', () => {
    expect(() => stackKind('kind')).toThrow(
      /E2E_STACK.*"kind".*compose.*minikube/,
    );
    expect(() => stackKind('Minikube')).toThrow(/E2E_STACK/);
  });
});

describe("the compose backend (today's calls)", () => {
  const healthy = JSON.stringify({ Health: 'healthy' });

  it('finds the container, kills it by id and starts it until healthy', async () => {
    const { stackDeps, lines } = deps([
      { when: ['ps', '--quiet'], result: { stdout: 'abc123\n' } },
      { when: ['kill'] },
      { when: ['start'] },
      { when: ['ps', '--format'], result: { stdout: `${healthy}\n` } },
    ]);
    const stack = createStackControl('compose', stackDeps);
    const id = stack.find('guardrails-server');
    stack.end(id);
    await stack.start('guardrails-server');
    expect(id).toBe('abc123');
    expect(lines()).toEqual([
      `docker ${COMPOSE.slice(7)} ps --quiet guardrails-server`,
      'docker kill abc123',
      `docker ${COMPOSE.slice(7)} start guardrails-server`,
      `docker ${COMPOSE.slice(7)} ps --format json guardrails-server`,
    ]);
  });

  it('refuses when no container runs', () => {
    const { stackDeps } = deps([
      { when: ['ps', '--quiet'], result: { stdout: '\n' } },
    ]);
    expect(() =>
      createStackControl('compose', stackDeps).find('guardrails-server'),
    ).toThrow(/No running container for guardrails-server/);
  });

  it('names the failed call and its message', () => {
    const { stackDeps } = deps([
      { when: ['kill'], result: { status: 1, stderr: 'no such container' } },
    ]);
    expect(() => createStackControl('compose', stackDeps).end('abc')).toThrow(
      /docker kill abc failed: no such container/,
    );
  });

  it('gives up after 60 seconds when the service never turns healthy', async () => {
    const { stackDeps } = deps([
      { when: ['start'] },
      {
        when: ['ps', '--format'],
        result: { stdout: '[{"Health":"starting"}]' },
      },
    ]);
    await expect(
      createStackControl('compose', stackDeps).start('guardrails-server'),
    ).rejects.toThrow(/did not become healthy within 60 seconds/);
  });
});

describe('the minikube backend (NFR2.24)', () => {
  const running = (name: string): Rule => ({
    when: ['get', 'pod'],
    result: { stdout: `${name}\n` },
  });

  it('finds the pod, scales to 0, waits for its deletion, scales to 1, waits for the rollout', async () => {
    const { stackDeps, lines } = deps([
      running('pod/guardrails-server-7d9f'),
      { when: ['scale'] },
      { when: ['wait'] },
      { when: ['rollout', 'status'] },
    ]);
    const stack = createStackControl('minikube', stackDeps);
    const name = stack.find('guardrails-server');
    stack.end(name);
    await stack.start('guardrails-server');
    expect(lines()).toEqual([
      `kubectl --context minikube -n guardrails-sample get pod -l app=guardrails-server --field-selector=status.phase=Running -o name`,
      `${KUBECTL} scale deployment/guardrails-server --replicas=0`,
      `${KUBECTL} wait --for=delete pod/guardrails-server-7d9f --timeout=30s`,
      `${KUBECTL} scale deployment/guardrails-server --replicas=1`,
      `${KUBECTL} rollout status deployment/guardrails-server --timeout=60s`,
    ]);
  });

  it('refuses when no server pod runs', () => {
    const { stackDeps } = deps([running('')]);
    expect(() =>
      createStackControl('minikube', stackDeps).find('guardrails-server'),
    ).toThrow(/No running pod for guardrails-server/);
  });

  it('only stops the guardrails server, never the app or the database', () => {
    const { stackDeps, lines } = deps([running('pod/postgres-0')]);
    expect(() =>
      createStackControl('minikube', stackDeps).find('postgres'),
    ).toThrow(/only the guardrails-server/i);
    expect(lines()).toEqual([]);
  });

  it('stops before scaling up when the deletion wait times out', () => {
    const { stackDeps, lines } = deps([
      { when: ['scale'] },
      {
        when: ['wait'],
        result: { status: 1, stderr: 'timed out waiting for the condition' },
      },
    ]);
    const stack = createStackControl('minikube', stackDeps);
    expect(() => stack.end('pod/guardrails-server-7d9f')).toThrow(
      /wait --for=delete.*failed: timed out/,
    );
    expect(lines().some(l => l.includes('--replicas=1'))).toBe(false);
  });

  it('names a failed scale or rollout call', async () => {
    const scale = deps([
      { when: ['scale'], result: { status: 1, stderr: 'forbidden' } },
    ]);
    expect(() =>
      createStackControl('minikube', scale.stackDeps).end('pod/x'),
    ).toThrow(
      /scale deployment\/guardrails-server --replicas=0 failed: forbidden/,
    );
    const rollout = deps([
      { when: ['scale'] },
      { when: ['rollout'], result: { status: 1, stderr: 'deadline exceeded' } },
    ]);
    await expect(
      createStackControl('minikube', rollout.stackDeps).start(
        'guardrails-server',
      ),
    ).rejects.toThrow(/rollout status.*failed: deadline exceeded/);
  });

  it('only ever calls kubectl with the minikube context', async () => {
    const { stackDeps, lines } = deps([
      running('pod/a'),
      { when: ['scale'] },
      { when: ['wait'] },
      { when: ['rollout'] },
    ]);
    const stack = createStackControl('minikube', stackDeps);
    stack.end(stack.find('guardrails-server'));
    await stack.start('guardrails-server');
    expect(
      lines().every(l => l.startsWith('kubectl --context minikube ')),
    ).toBe(true);
  });
});
