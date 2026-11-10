import { CommandResult, RunOptions, Runner } from './runner';

/** The only cluster a command of this package may change (NFR5.17). */
export const CONTEXT = 'minikube';
export const PROFILE = 'minikube';
export const NAMESPACE = 'guardrails-sample';

const FORBIDDEN_KUBECTL = [
  '--context',
  '-n',
  '--namespace',
  '-A',
  '--all-namespaces',
  '--kubeconfig',
  '--cluster',
  '--server',
];
const FORBIDDEN_MINIKUBE = ['-p', '--profile'];

function refuseOwnTarget(extra: string[], forbidden: string[]): void {
  const clash = extra.find(arg =>
    forbidden.some(name => arg === name || arg.startsWith(`${name}=`)),
  );
  if (clash !== undefined) {
    throw new Error(
      `A cluster call must not set its own target (${clash}); minikubeArgs sets the context, the namespace and the profile.`,
    );
  }
}

/**
 * The one place that builds the arguments of a `kubectl` call in the
 * namespace of the sample. Every call names the context, so a context
 * switched in another terminal cannot redirect it (NFR5.17).
 */
export function kubectlArgs(extra: string[]): string[] {
  refuseOwnTarget(extra, FORBIDDEN_KUBECTL);
  return ['--context', CONTEXT, '-n', NAMESPACE, ...extra];
}

/** A `kubectl` call above the namespace (create, find and delete the namespace). */
export function kubectlClusterArgs(extra: string[]): string[] {
  refuseOwnTarget(extra, FORBIDDEN_KUBECTL);
  return ['--context', CONTEXT, ...extra];
}

/** A `minikube` call: always the `minikube` profile. */
export function minikubeArgs(extra: string[]): string[] {
  refuseOwnTarget(extra, FORBIDDEN_MINIKUBE);
  return ['--profile', PROFILE, ...extra];
}

export function runKubectl(
  run: Runner,
  extra: string[],
  options?: RunOptions,
): CommandResult {
  return run('kubectl', kubectlArgs(extra), options);
}

export function runKubectlCluster(
  run: Runner,
  extra: string[],
  options?: RunOptions,
): CommandResult {
  return run('kubectl', kubectlClusterArgs(extra), options);
}

export function runMinikube(
  run: Runner,
  extra: string[],
  options?: RunOptions,
): CommandResult {
  return run('minikube', minikubeArgs(extra), options);
}
