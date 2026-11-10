import { assertLocalContext, checkTools, profileRunning } from './clusterGuard';
import { ensureSecret } from './dbSecret';
import { RandomSource } from './envFile';
import { buildImages, checkAppImageSize } from './imageBuild';
import {
  NAMESPACE,
  runKubectl,
  runKubectlCluster,
  runMinikube,
} from './minikubeArgs';
import {
  ForwardOps,
  LOCAL_PORT,
  realForwardOps,
  startForward,
  stopForward,
} from './portForward';
import { realRunner, Runner } from './runner';

export const ADDRESS = `http://localhost:${LOCAL_PORT}`;
/** The readiness route of the app, asked through the port-forward. */
export const READINESS_URL = `http://127.0.0.1:${LOCAL_PORT}/.backstage/health/v1/readiness`;
/** The bound of NFR1.6: every workload ready and the route answering. */
export const ROLLOUT_BOUND_SECONDS = 300;
const WORKLOADS = [
  'statefulset/postgres',
  'deployment/guardrails-server',
  'deployment/app',
];

export interface MiniDeps {
  run: Runner;
  /** The repository root: k8s/ and the process-id file live here. */
  root: string;
  log: (message: string) => void;
  ops: ForwardOps;
  random?: RandomSource;
  now: () => number;
  /** True when the readiness route answers 200. */
  ready: (url: string) => Promise<boolean>;
}

/** The real machine: the process runner, the forward operations and an HTTP fetch. */
export function realMinikubeDeps(
  root: string,
  log: (message: string) => void,
): MiniDeps {
  return {
    run: realRunner,
    root,
    log,
    ops: realForwardOps(realRunner),
    now: () => Date.now(),
    ready: async url => {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(2000),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

async function phase<T>(
  deps: MiniDeps,
  name: string,
  work: () => Promise<T> | T,
): Promise<T> {
  const start = deps.now();
  try {
    return await work();
  } finally {
    deps.log(`phase ${name}: ${Math.round((deps.now() - start) / 1000)} s`);
  }
}

/** What a failed start prints: sample status, descriptions and each pod's log (NFR2.22). */
export function printDiagnosis(deps: MiniDeps): void {
  const show = (title: string, text: string) =>
    deps.log(`--- ${title} ---\n${text.trim()}`);
  const status = runKubectl(deps.run, ['get', 'pods,svc,pvc']);
  show('kubectl get pods,svc,pvc', status.stdout || status.stderr);
  const describe = runKubectl(deps.run, ['describe', 'pods']);
  show('kubectl describe pods', describe.stdout || describe.stderr);
  const names = runKubectl(deps.run, ['get', 'pods', '-o', 'name']);
  for (const name of names.stdout.split('\n').filter(Boolean)) {
    const logs = runKubectl(deps.run, [
      'logs',
      name,
      '--all-containers=true',
      '--tail=200',
    ]);
    show(`log of ${name}`, logs.stdout || logs.stderr);
  }
}

function ensureCluster(deps: MiniDeps): void {
  if (profileRunning(deps.run)) {
    // A shell left on another context is refused before anything is started.
    assertLocalContext(deps.run);
  } else {
    const start = runMinikube(
      deps.run,
      ['start', '--driver=docker', '--cpus=2', '--memory=4096'],
      { inherit: true },
    );
    if (start.status !== 0 || start.error) {
      throw new Error(
        `"minikube start" failed (exit ${start.status ?? 'none'}${start.error ? `, ${start.error}` : ''}). Fix the cause shown above and try again.`,
      );
    }
  }
  // minikube start points kubectl at its own context; check before any change.
  assertLocalContext(deps.run);
}

function ensureNamespace(deps: MiniDeps): void {
  const found = runKubectlCluster(deps.run, [
    'get',
    'namespace',
    NAMESPACE,
    '-o',
    'name',
  ]);
  if (found.status === 0 && !found.error) return;
  if (found.error || !/NotFound|not found/i.test(found.stderr)) {
    throw new Error(
      `Could not look for the namespace ${NAMESPACE}: ${(found.error ?? found.stderr).trim()}`,
    );
  }
  const created = runKubectlCluster(deps.run, [
    'create',
    'namespace',
    NAMESPACE,
  ]);
  if (created.status !== 0 || created.error) {
    throw new Error(
      `Could not create the namespace ${NAMESPACE}: ${(created.error ?? created.stderr).trim()}`,
    );
  }
}

function applyManifests(deps: MiniDeps): void {
  const applied = runKubectl(deps.run, ['apply', '-k', 'k8s/'], {
    cwd: deps.root,
    inherit: true,
  });
  if (applied.status !== 0 || applied.error) {
    throw new Error(
      `"kubectl apply -k k8s/" failed (exit ${applied.status ?? 'none'}). See the message above.`,
    );
  }
}

function waitReady(deps: MiniDeps, deadline: number): void {
  for (const workload of WORKLOADS) {
    const remaining = Math.max(1, Math.ceil((deadline - deps.now()) / 1000));
    const result = runKubectl(deps.run, [
      'rollout',
      'status',
      workload,
      `--timeout=${remaining}s`,
    ]);
    if (result.status !== 0 || result.error) {
      printDiagnosis(deps);
      throw new Error(
        `${workload} did not become ready within ${ROLLOUT_BOUND_SECONDS} seconds (${(result.error ?? result.stderr).trim() || `exit ${result.status}`}). The status and logs are printed above.`,
      );
    }
  }
}

async function waitForRoute(deps: MiniDeps, deadline: number): Promise<void> {
  while (!(await deps.ready(READINESS_URL))) {
    if (deps.now() >= deadline) {
      printDiagnosis(deps);
      throw new Error(
        `The readiness route of the app did not answer through the port-forward within ${ROLLOUT_BOUND_SECONDS} seconds. The status and logs are printed above.`,
      );
    }
    await deps.ops.sleep(1000);
  }
}

/** `yarn minikube:up` (FR9.1, NFR2.19): one command, no other manual step. */
export async function minikubeUp(deps: MiniDeps): Promise<void> {
  await phase(deps, 'tools', () => checkTools(deps.run));
  await phase(deps, 'cluster', () => ensureCluster(deps));
  await phase(deps, 'images', () => {
    buildImages(deps.run, deps.root, deps.log);
    const problems = checkAppImageSize(deps.run, deps.log);
    if (problems.length > 0) throw new Error(problems.join('\n'));
  });
  const deadline = deps.now() + ROLLOUT_BOUND_SECONDS * 1000;
  await phase(deps, 'apply', () => {
    ensureNamespace(deps);
    const { created } = ensureSecret(deps.run, deps.random);
    deps.log(
      created
        ? 'Created the database Secret with a generated password (not shown).'
        : 'Using the existing database Secret.',
    );
    applyManifests(deps);
  });
  await phase(deps, 'rollout', () => waitReady(deps, deadline));
  await phase(deps, 'forward', async () => {
    await startForward({ root: deps.root, ops: deps.ops, log: deps.log });
    await waitForRoute(deps, deadline);
  });
  deps.log(
    `The sample is running. Open ${ADDRESS} (the forward listens on 127.0.0.1 only).`,
  );
}

/** `yarn minikube:down` (NFR2.23, NFR5.22): stops the forward, removes the namespace. */
export async function minikubeDown(deps: MiniDeps): Promise<void> {
  checkTools(deps.run);
  const forward = { root: deps.root, ops: deps.ops, log: deps.log };
  if (!profileRunning(deps.run)) {
    stopForward(forward);
    deps.log(
      'The minikube cluster is not running, so there is nothing to delete.',
    );
    return;
  }
  assertLocalContext(deps.run);
  stopForward(forward);
  const deleted = runKubectlCluster(deps.run, [
    'delete',
    'namespace',
    NAMESPACE,
    '--ignore-not-found=true',
    '--wait=true',
    '--timeout=180s',
  ]);
  if (deleted.status !== 0 || deleted.error) {
    throw new Error(
      `Could not delete the namespace ${NAMESPACE}: ${(deleted.error ?? deleted.stderr).trim() || `exit ${deleted.status}`}`,
    );
  }
  deps.log(
    `Stopped. The namespace ${NAMESPACE} and all its data are gone (the database claim and the Secret went with it). The minikube cluster itself was left running.`,
  );
}
