import { CONTEXT, PROFILE, runMinikube } from './minikubeArgs';
import { Runner } from './runner';

const TOOLS: Array<{
  name: string;
  args: string[];
  label: string;
  where: string;
}> = [
  {
    name: 'docker',
    args: ['--version'],
    label: 'Docker',
    where: 'https://docs.docker.com/get-docker/',
  },
  {
    name: 'minikube',
    args: ['version'],
    label: 'minikube',
    where: 'https://minikube.sigs.k8s.io/docs/start/',
  },
  {
    name: 'kubectl',
    args: ['version', '--client'],
    label: 'kubectl',
    where: 'https://kubernetes.io/docs/tasks/tools/',
  },
];

/** Stops with a plain message that names the first missing tool (NFR2.19). */
export function checkTools(run: Runner): void {
  for (const tool of TOOLS) {
    const result = run(tool.name, tool.args);
    if (result.error || result.status !== 0) {
      throw new Error(
        `${tool.label} is not installed or not on the PATH. Install it (${tool.where}) and try again.`,
      );
    }
  }
}

/** True when the `minikube` profile reports its host as running. */
export function profileRunning(run: Runner): boolean {
  const result = runMinikube(run, ['status', '--format', '{{.Host}}']);
  return (
    !result.error && result.status === 0 && result.stdout.trim() === 'Running'
  );
}

/** The current kubectl context; its call sets no context of its own. */
export function currentContext(run: Runner): string {
  const result = run('kubectl', ['config', 'current-context']);
  if (result.error || result.status !== 0) {
    throw new Error(
      `The current kubectl context could not be read (${(result.error ?? result.stderr).trim()}). Nothing was changed.`,
    );
  }
  return result.stdout.trim();
}

/**
 * Refuses to go on unless kubectl points at the local `minikube` context and
 * the `minikube` profile is running (NFR5.17). It only reads. The check does
 * not trust the server address; the context name and the profile must both
 * be the local ones.
 */
export function assertLocalContext(run: Runner): void {
  const context = currentContext(run);
  if (context !== CONTEXT) {
    throw new Error(
      `kubectl points at the context "${context}", not "${CONTEXT}". This sample only ever runs on the local minikube cluster. Nothing was changed. Run "kubectl config use-context ${CONTEXT}" and try again.`,
    );
  }
  if (!profileRunning(run)) {
    throw new Error(
      `The minikube profile "${PROFILE}" is not running. Nothing was changed.`,
    );
  }
}
