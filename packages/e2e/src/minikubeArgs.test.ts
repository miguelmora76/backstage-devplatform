import {
  CONTEXT,
  kubectlArgs,
  kubectlClusterArgs,
  minikubeArgs,
  NAMESPACE,
  PROFILE,
  runKubectl,
  runMinikube,
} from './minikubeArgs';
import { fakeRunner } from './testing/fakeRunner';

describe('kubectlArgs (NFR5.17)', () => {
  it('puts the context and the namespace in front of every call', () => {
    expect(kubectlArgs(['get', 'pods'])).toEqual([
      '--context',
      CONTEXT,
      '-n',
      NAMESPACE,
      'get',
      'pods',
    ]);
    expect(CONTEXT).toBe('minikube');
    expect(NAMESPACE).toBe('guardrails-sample');
  });

  it('carries the context on every list it builds', () => {
    const lists = [
      kubectlArgs(['apply', '-k', 'k8s/']),
      kubectlArgs(['rollout', 'status', 'deployment/app']),
      kubectlClusterArgs(['create', 'namespace', NAMESPACE]),
      kubectlClusterArgs(['delete', 'namespace', NAMESPACE]),
    ];
    for (const list of lists) {
      expect(list.slice(0, 2)).toEqual(['--context', 'minikube']);
    }
  });

  it.each([
    ['--context', 'other'],
    ['--context=other'],
    ['-n', 'default'],
    ['--namespace', 'default'],
    ['--namespace=default'],
    ['-A'],
    ['--all-namespaces'],
    ['--kubeconfig', '/tmp/other'],
  ])('refuses a caller that sets %s', (...extra) => {
    expect(() => kubectlArgs(['get', 'pods', ...extra])).toThrow(
      /must not set its own/,
    );
    expect(() => kubectlClusterArgs(['get', 'pods', ...extra])).toThrow(
      /must not set its own/,
    );
  });

  it('leaves the namespace out of the cluster-level calls only', () => {
    expect(kubectlClusterArgs(['get', 'namespace'])).toEqual([
      '--context',
      'minikube',
      'get',
      'namespace',
    ]);
  });
});

describe('minikubeArgs', () => {
  it('names the profile on every call and refuses another one', () => {
    expect(minikubeArgs(['status'])).toEqual(['--profile', PROFILE, 'status']);
    expect(() => minikubeArgs(['status', '-p', 'other'])).toThrow(
      /must not set its own/,
    );
    expect(() => minikubeArgs(['start', '--profile=other'])).toThrow(
      /must not set its own/,
    );
  });
});

describe('runKubectl and runMinikube', () => {
  it('run the built argument lists through the runner', () => {
    const { run, lines } = fakeRunner([
      { when: ['kubectl'], result: { stdout: 'a' } },
      { when: ['minikube'], result: { stdout: 'b' } },
    ]);
    expect(runKubectl(run, ['get', 'pods']).stdout).toBe('a');
    expect(runMinikube(run, ['status']).stdout).toBe('b');
    expect(lines()).toEqual([
      'kubectl --context minikube -n guardrails-sample get pods',
      'minikube --profile minikube status',
    ]);
  });
});
