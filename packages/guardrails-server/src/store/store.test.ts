import {
  DEFAULT_SEED,
  compareText,
  generateDataSet,
  type SeedDataSet,
} from '../generator';
import { DataStore } from './dataStore';
import { GuardrailsData } from './guardrailsData';
import { RuntimeOverlay } from './overlay';

const dataSet: SeedDataSet = generateDataSet(DEFAULT_SEED);

function serviceWithoutDependencies(): string {
  const withDeps = new Set(dataSet.dependencies.map(d => d.serviceName));
  return dataSet.services.find(s => !withDeps.has(s.serviceName))!.serviceName;
}

function serviceWithoutFailedRuns(): string {
  const withFailed = new Set(
    dataSet.ciRuns.filter(r => r.status === 'failed').map(r => r.serviceName),
  );
  return dataSet.services.find(s => !withFailed.has(s.serviceName))!
    .serviceName;
}

function behindDependency() {
  return dataSet.dependencies.find(
    d => d.currentVersion !== d.recommendedVersion,
  )!;
}

function currentDependency() {
  return dataSet.dependencies.find(
    d => d.currentVersion === d.recommendedVersion,
  )!;
}

function failedRun() {
  return dataSet.ciRuns.find(r => r.status === 'failed')!;
}

describe('DataStore', () => {
  const store = new DataStore(dataSet);

  it('knows every seeded service and no other', () => {
    for (const service of dataSet.services) {
      expect(store.hasService(service.serviceName)).toBe(true);
    }
    expect(store.hasService('no-such-service')).toBe(false);
    expect(store.hasService('')).toBe(false);
    expect(store.serviceNames()).toEqual(
      dataSet.services.map(s => s.serviceName),
    );
  });

  it('prepares each plan ordered by name (BR2.1)', () => {
    for (const service of dataSet.services) {
      const plan = store.plan(service.serviceName)!;
      const names = plan.map(p => p.name);
      expect(names).toEqual([...names].sort(compareText));
      expect(plan).toHaveLength(
        dataSet.dependencies.filter(d => d.serviceName === service.serviceName)
          .length,
      );
    }
  });

  it('prepares the failed runs newest first, failed only (BR2.2)', () => {
    for (const service of dataSet.services) {
      const runs = store.failedRuns(service.serviceName)!;
      const numbers = runs.map(r => r.runNumber);
      expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
      for (const run of runs) {
        expect(run.status).toBe('failed');
        expect(run.cause.length).toBeGreaterThan(0);
      }
      expect(runs).toHaveLength(
        dataSet.ciRuns.filter(
          r => r.serviceName === service.serviceName && r.status === 'failed',
        ).length,
      );
    }
  });

  it('gives empty lists, not errors, for services with nothing to list', () => {
    expect(store.plan(serviceWithoutDependencies())).toEqual([]);
    expect(store.failedRuns(serviceWithoutFailedRuns())).toEqual([]);
  });

  it('returns undefined for an unknown service', () => {
    expect(store.plan('no-such-service')).toBeUndefined();
    expect(store.failedRuns('no-such-service')).toBeUndefined();
  });

  it('finds a dependency or run only under its own service', () => {
    const dependency = behindDependency();
    const run = failedRun();
    expect(
      store.dependency(dependency.serviceName, dependency.dependencyKey),
    ).toEqual(dependency);
    expect(store.run(run.serviceName, run.runKey)).toEqual(run);
    const other = dataSet.services.find(
      s => s.serviceName !== dependency.serviceName,
    )!.serviceName;
    expect(store.dependency(other, dependency.dependencyKey)).toBeUndefined();
    expect(store.dependency(other, 'nope/nothing')).toBeUndefined();
    const otherForRun = dataSet.services.find(
      s => s.serviceName !== run.serviceName,
    )!.serviceName;
    expect(store.run(otherForRun, run.runKey)).toBeUndefined();
  });
});

describe('RuntimeOverlay', () => {
  it('starts empty and adds a key in one step, a repeat adding nothing', () => {
    const overlay = new RuntimeOverlay();
    expect(overlay.upgradedDependencies.size).toBe(0);
    expect(overlay.rerunRuns.size).toBe(0);
    expect(overlay.markUpgraded('a/b')).toBe(true);
    expect(overlay.markUpgraded('a/b')).toBe(false);
    expect(overlay.markRerun('a#1')).toBe(true);
    expect(overlay.markRerun('a#1')).toBe(false);
    expect(overlay.isUpgraded('a/b')).toBe(true);
    expect(overlay.isRerun('a#1')).toBe(true);
    expect(overlay.isUpgraded('a/c')).toBe(false);
    expect(overlay.upgradedDependencies.size).toBe(1);
    expect(overlay.rerunRuns.size).toBe(1);
  });

  it('keeps separate instances apart', () => {
    const first = new RuntimeOverlay();
    const second = new RuntimeOverlay();
    first.markUpgraded('x/y');
    expect(second.isUpgraded('x/y')).toBe(false);
  });
});

describe('GuardrailsData', () => {
  it('reports the seeded plan and failed runs before any change', () => {
    const data = new GuardrailsData(dataSet);
    const dependency = behindDependency();
    const plan = data.plan(dependency.serviceName)!;
    const item = plan.find(p => p.dependencyKey === dependency.dependencyKey)!;
    expect(item).toEqual({
      dependencyKey: dependency.dependencyKey,
      name: dependency.name,
      currentVersion: dependency.currentVersion,
      recommendedVersion: dependency.recommendedVersion,
    });
    const run = failedRun();
    expect(
      data.failedRuns(run.serviceName)!.some(r => r.runKey === run.runKey),
    ).toBe(true);
  });

  it('applies an upgrade: the plan then shows current equal to recommended (BR2.1, BR2.3)', () => {
    const data = new GuardrailsData(dataSet);
    const dependency = behindDependency();
    const outcome = data.applyUpgrade(
      dependency.serviceName,
      dependency.dependencyKey,
    );
    expect(outcome).toEqual({
      ok: true,
      value: {
        dependencyKey: dependency.dependencyKey,
        currentVersion: dependency.recommendedVersion,
        result: 'applied',
      },
    });
    const item = data
      .plan(dependency.serviceName)!
      .find(p => p.dependencyKey === dependency.dependencyKey)!;
    expect(item.currentVersion).toBe(dependency.recommendedVersion);
    expect(item.recommendedVersion).toBe(dependency.recommendedVersion);
  });

  it('treats a repeated apply and an already-current dependency as no-ops (BR2.3)', () => {
    const data = new GuardrailsData(dataSet);
    const dependency = behindDependency();
    data.applyUpgrade(dependency.serviceName, dependency.dependencyKey);
    const again = data.applyUpgrade(
      dependency.serviceName,
      dependency.dependencyKey,
    );
    expect(again).toMatchObject({
      ok: true,
      value: { result: 'already-current' },
    });
    expect(data.overlay.upgradedDependencies.size).toBe(1);

    const current = currentDependency();
    const noop = data.applyUpgrade(current.serviceName, current.dependencyKey);
    expect(noop).toMatchObject({
      ok: true,
      value: { result: 'already-current' },
    });
    expect(data.overlay.upgradedDependencies.size).toBe(1);
  });

  it('takes a re-run out of the failed list, and a repeat changes nothing more (BR2.4)', () => {
    const data = new GuardrailsData(dataSet);
    const run = failedRun();
    const before = data.failedRuns(run.serviceName)!.length;
    const first = data.rerun(run.serviceName, run.runKey);
    expect(first).toEqual({
      ok: true,
      value: { runKey: run.runKey, result: 'rerun-started' },
    });
    expect(data.failedRuns(run.serviceName)!).toHaveLength(before - 1);
    expect(data.rerun(run.serviceName, run.runKey)).toEqual(first);
    expect(data.failedRuns(run.serviceName)!).toHaveLength(before - 1);
    expect(data.overlay.rerunRuns.size).toBe(1);
  });

  it('answers rerun-started for a run that was never failed and changes nothing', () => {
    const data = new GuardrailsData(dataSet);
    const passed = dataSet.ciRuns.find(r => r.status === 'passed')!;
    expect(data.rerun(passed.serviceName, passed.runKey)).toEqual({
      ok: true,
      value: { runKey: passed.runKey, result: 'rerun-started' },
    });
    expect(data.overlay.rerunRuns.size).toBe(0);
  });

  it('reports unknown services and keys in the fixed order (BR3.3)', () => {
    const data = new GuardrailsData(dataSet);
    const dependency = behindDependency();
    const other = dataSet.services.find(
      s => s.serviceName !== dependency.serviceName,
    )!.serviceName;
    expect(data.applyUpgrade('no-such-service', 'x')).toEqual({
      ok: false,
      code: 'UNKNOWN_SERVICE',
    });
    expect(data.applyUpgrade(dependency.serviceName, 'x')).toEqual({
      ok: false,
      code: 'UNKNOWN_DEPENDENCY',
    });
    expect(data.applyUpgrade(other, dependency.dependencyKey)).toEqual({
      ok: false,
      code: 'UNKNOWN_DEPENDENCY',
    });
    expect(data.rerun('no-such-service', 'x')).toEqual({
      ok: false,
      code: 'UNKNOWN_SERVICE',
    });
    expect(data.rerun(other, failedRun().runKey)).toEqual({
      ok: false,
      code: 'UNKNOWN_RUN',
    });
    expect(data.overlay.upgradedDependencies.size).toBe(0);
    expect(data.overlay.rerunRuns.size).toBe(0);
  });

  it('gives the seeded state again after a restart (NFR7.3)', () => {
    const data = new GuardrailsData(dataSet);
    const dependency = behindDependency();
    const run = failedRun();
    data.applyUpgrade(dependency.serviceName, dependency.dependencyKey);
    data.rerun(run.serviceName, run.runKey);
    const restarted = new GuardrailsData(dataSet);
    const fresh = new GuardrailsData(generateDataSet(DEFAULT_SEED));
    for (const service of dataSet.services) {
      expect(restarted.plan(service.serviceName)).toEqual(
        fresh.plan(service.serviceName),
      );
      expect(restarted.failedRuns(service.serviceName)).toEqual(
        fresh.failedRuns(service.serviceName),
      );
    }
    expect(restarted.overlay.upgradedDependencies.size).toBe(0);
  });

  it('hands out copies, so a caller cannot change the data', () => {
    const data = new GuardrailsData(dataSet);
    const dependency = behindDependency();
    const plan = data.plan(dependency.serviceName)!;
    plan[0].currentVersion = '9.9.9';
    plan.pop();
    expect(data.plan(dependency.serviceName)![0].currentVersion).not.toBe(
      '9.9.9',
    );
    expect(data.hasService(dependency.serviceName)).toBe(true);
    expect(data.hasService('no-such-service')).toBe(false);
  });
});
