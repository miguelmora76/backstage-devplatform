import { COMPOSE_STACK, runCompose } from './composeArgs';
import { runKubectl } from './minikubeArgs';
import { CommandResult, Runner } from './runner';

export type StackKind = typeof COMPOSE_STACK | 'minikube';

/** `E2E_STACK`: the compose run unless the value says `minikube`; anything else is refused (NFR2.24). */
export function stackKind(value: string | undefined): StackKind {
  if (value === undefined || value === '' || value === COMPOSE_STACK) {
    return COMPOSE_STACK;
  }
  if (value === 'minikube') return 'minikube';
  throw new Error(
    `E2E_STACK is "${value}". Use ${COMPOSE_STACK} (the default) or minikube.`,
  );
}

export interface StackDeps {
  run: Runner;
  /** The repository root, where compose.yaml and .env.compose live. */
  root: string;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

/**
 * Control of the one service the flows stop: the guardrails server (a failed
 * change that is retried). `find` names what to end, `end` ends it so that it
 * is down from then on, `start` brings it back and waits until it is ready.
 */
export interface StackControl {
  find(service: string): string;
  end(handle: string): void;
  start(service: string): Promise<void>;
}

const SERVER = 'guardrails-server';
const START_WAIT_MS = 60_000;

function checked(what: string, result: CommandResult): string {
  if (result.status !== 0 || result.error) {
    throw new Error(
      `${what} failed: ${(result.error ?? result.stderr).trim() || `exit ${result.status}`}`,
    );
  }
  return result.stdout;
}

function composeBackend(deps: StackDeps): StackControl {
  const compose = (extra: string[]) =>
    runCompose(deps.run, extra, { cwd: deps.root });
  return {
    find(service) {
      const id = checked(
        `docker compose ps --quiet ${service}`,
        compose(['ps', '--quiet', service]),
      ).trim();
      if (!id) throw new Error(`No running container for ${service}`);
      return id;
    },
    // One quick docker call, not a stop with a grace period and not a compose
    // call, so the server is down well inside the 5 seconds the plugin reuses
    // a health probe result for.
    end(id) {
      checked(`docker kill ${id}`, deps.run('docker', ['kill', id]));
    },
    async start(service) {
      checked(`docker compose start ${service}`, compose(['start', service]));
      const deadline = deps.now() + START_WAIT_MS;
      while (deps.now() < deadline) {
        const out = checked(
          `docker compose ps ${service}`,
          compose(['ps', '--format', 'json', service]),
        ).trim();
        const rows = out.startsWith('[')
          ? JSON.parse(out)
          : out
              .split('\n')
              .filter(Boolean)
              .map(line => JSON.parse(line));
        if (rows.some((row: { Health?: string }) => row.Health === 'healthy')) {
          return;
        }
        await deps.sleep(1000);
      }
      throw new Error(`${service} did not become healthy within 60 seconds`);
    },
  };
}

function minikubeBackend(deps: StackDeps): StackControl {
  const kubectl = (extra: string[]) => runKubectl(deps.run, extra);
  return {
    find(service) {
      if (service !== SERVER) {
        throw new Error(
          `The flows stop only the ${SERVER}; "${service}" is not stoppable on minikube.`,
        );
      }
      const name = checked(
        `kubectl get pod -l app=${service}`,
        kubectl([
          'get',
          'pod',
          '-l',
          `app=${service}`,
          '--field-selector=status.phase=Running',
          '-o',
          'name',
        ]),
      )
        .split('\n')
        .find(Boolean);
      if (!name) throw new Error(`No running pod for ${service}`);
      return name;
    },
    // Scale to zero and wait for the pod object to be gone, so the spec never
    // goes on while the old pod could still answer, and the later start
    // cannot match a pod that is terminating.
    end(pod) {
      checked(
        `kubectl scale deployment/${SERVER} --replicas=0`,
        kubectl(['scale', `deployment/${SERVER}`, '--replicas=0']),
      );
      checked(
        `kubectl wait --for=delete ${pod}`,
        kubectl(['wait', '--for=delete', pod, '--timeout=30s']),
      );
    },
    async start(service) {
      checked(
        `kubectl scale deployment/${service} --replicas=1`,
        kubectl(['scale', `deployment/${service}`, '--replicas=1']),
      );
      checked(
        `kubectl rollout status deployment/${service}`,
        kubectl([
          'rollout',
          'status',
          `deployment/${service}`,
          '--timeout=60s',
        ]),
      );
    },
  };
}

export function createStackControl(
  kind: StackKind,
  deps: StackDeps,
): StackControl {
  return kind === 'minikube' ? minikubeBackend(deps) : composeBackend(deps);
}
