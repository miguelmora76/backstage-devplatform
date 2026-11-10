import {
  assertLocalContext,
  checkTools,
  currentContext,
  profileRunning,
} from './clusterGuard';
import { fakeRunner, Rule } from './testing/fakeRunner';

const running: Rule = {
  when: ['minikube', 'status'],
  result: { stdout: 'Running\n' },
};
const onContext = (name: string): Rule => ({
  when: ['kubectl', 'config', 'current-context'],
  result: { stdout: `${name}\n` },
});

describe('checkTools (NFR2.19)', () => {
  const present: Rule[] = [
    { when: ['docker', '--version'] },
    { when: ['minikube', 'version'] },
    { when: ['kubectl', 'version', '--client'] },
  ];

  it('passes when docker, minikube and kubectl answer', () => {
    const { run, lines } = fakeRunner(present);
    expect(() => checkTools(run)).not.toThrow();
    expect(lines()).toHaveLength(3);
  });

  it.each([
    ['docker', 'Docker'],
    ['minikube', 'minikube'],
    ['kubectl', 'kubectl'],
  ])('names the missing tool %s in a plain message', (tool, label) => {
    const { run } = fakeRunner([
      {
        when: [tool],
        result: { status: null, error: 'spawn ENOENT' },
      },
      ...present,
    ]);
    expect(() => checkTools(run)).toThrow(
      new RegExp(`${label}.*not installed`),
    );
  });

  it('treats a tool that exits non-zero as missing', () => {
    const { run } = fakeRunner([
      { when: ['kubectl'], result: { status: 1 } },
      ...present,
    ]);
    expect(() => checkTools(run)).toThrow(/kubectl/);
  });
});

describe('profileRunning', () => {
  it('is true when the host is Running', () => {
    expect(profileRunning(fakeRunner([running]).run)).toBe(true);
  });

  it('is false when stopped or when minikube fails', () => {
    const stopped = fakeRunner([
      { when: ['minikube'], result: { status: 7, stdout: 'Stopped\n' } },
    ]);
    expect(profileRunning(stopped.run)).toBe(false);
    const broken = fakeRunner([
      { when: ['minikube'], result: { status: null, error: 'ENOENT' } },
    ]);
    expect(profileRunning(broken.run)).toBe(false);
  });
});

describe('assertLocalContext (NFR5.17)', () => {
  it('passes on the minikube context with the profile running', () => {
    const { run } = fakeRunner([onContext('minikube'), running]);
    expect(() => assertLocalContext(run)).not.toThrow();
  });

  it('refuses another context, names it and says nothing was changed', () => {
    const { run, lines } = fakeRunner([onContext('prod-cluster'), running]);
    expect(() => assertLocalContext(run)).toThrow(/prod-cluster/);
    expect(() => assertLocalContext(run)).toThrow(/Nothing was changed/);
    // Only reads: no apply, create or delete was attempted.
    expect(lines().join('\n')).not.toMatch(/apply|create|delete/);
  });

  it('refuses when the minikube profile is not running', () => {
    const { run } = fakeRunner([
      onContext('minikube'),
      {
        when: ['minikube', 'status'],
        result: { status: 7, stdout: 'Stopped' },
      },
    ]);
    expect(() => assertLocalContext(run)).toThrow(/profile.*not running/);
  });

  it('refuses when the current context cannot be read', () => {
    const { run } = fakeRunner([
      {
        when: ['kubectl', 'config'],
        result: { status: 1, stderr: 'error: current-context is not set' },
      },
      running,
    ]);
    expect(() => assertLocalContext(run)).toThrow(/current-context is not set/);
  });

  it('reads the current context with a call that sets no context of its own', () => {
    const { run, lines } = fakeRunner([onContext('minikube')]);
    expect(currentContext(run)).toBe('minikube');
    expect(lines()).toEqual(['kubectl config current-context']);
  });
});
