import type { SeedDataSet } from '../generator';
import { DataStore } from './dataStore';
import { RuntimeOverlay } from './overlay';

export type LookupCode =
  'UNKNOWN_SERVICE' | 'UNKNOWN_DEPENDENCY' | 'UNKNOWN_RUN';

export type Outcome<T> =
  { ok: true; value: T } | { ok: false; code: LookupCode };

export interface PlanItem {
  dependencyKey: string;
  name: string;
  currentVersion: string;
  recommendedVersion: string;
}

export interface FailedRunItem {
  runKey: string;
  runNumber: number;
  status: 'failed';
  cause: string;
}

export interface UpgradeResult {
  dependencyKey: string;
  currentVersion: string;
  result: 'applied' | 'already-current';
}

export interface RerunResult {
  runKey: string;
  result: 'rerun-started';
}

/**
 * The read-only store combined with the in-memory overlay. Every method is
 * synchronous, with nothing that waits between a check and a change, so calls
 * take effect one at a time in the order they arrive (BR2.6). Creating a new
 * instance from the same data set is a restart (BR2.5).
 */
export class GuardrailsData {
  readonly overlay: RuntimeOverlay;
  private readonly store: DataStore;

  constructor(
    dataSet: SeedDataSet,
    overlay: RuntimeOverlay = new RuntimeOverlay(),
  ) {
    this.store = new DataStore(dataSet);
    this.overlay = overlay;
  }

  hasService(serviceName: string): boolean {
    return this.store.hasService(serviceName);
  }

  plan(serviceName: string): PlanItem[] | undefined {
    return this.store.plan(serviceName)?.map(d => ({
      dependencyKey: d.dependencyKey,
      name: d.name,
      currentVersion: this.overlay.isUpgraded(d.dependencyKey)
        ? d.recommendedVersion
        : d.currentVersion,
      recommendedVersion: d.recommendedVersion,
    }));
  }

  failedRuns(serviceName: string): FailedRunItem[] | undefined {
    return this.store
      .failedRuns(serviceName)
      ?.filter(r => !this.overlay.isRerun(r.runKey))
      .map(r => ({ ...r }));
  }

  applyUpgrade(
    serviceName: string,
    dependencyKey: string,
  ): Outcome<UpgradeResult> {
    if (!this.store.hasService(serviceName)) {
      return { ok: false, code: 'UNKNOWN_SERVICE' };
    }
    const dependency = this.store.dependency(serviceName, dependencyKey);
    if (dependency === undefined) {
      return { ok: false, code: 'UNKNOWN_DEPENDENCY' };
    }
    const behind =
      dependency.currentVersion !== dependency.recommendedVersion &&
      !this.overlay.isUpgraded(dependencyKey);
    if (behind) {
      this.overlay.markUpgraded(dependencyKey);
    }
    return {
      ok: true,
      value: {
        dependencyKey,
        currentVersion: dependency.recommendedVersion,
        result: behind ? 'applied' : 'already-current',
      },
    };
  }

  rerun(serviceName: string, runKey: string): Outcome<RerunResult> {
    if (!this.store.hasService(serviceName)) {
      return { ok: false, code: 'UNKNOWN_SERVICE' };
    }
    const run = this.store.run(serviceName, runKey);
    if (run === undefined) {
      return { ok: false, code: 'UNKNOWN_RUN' };
    }
    if (run.status === 'failed') {
      this.overlay.markRerun(runKey);
    }
    return { ok: true, value: { runKey, result: 'rerun-started' } };
  }
}
