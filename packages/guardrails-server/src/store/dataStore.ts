import type { CiRun, Dependency, SeedDataSet } from '../generator';
import { compareText } from '../generator';

/** A seeded failed run as the failed list shows it. */
export interface FailedRunEntry {
  runKey: string;
  runNumber: number;
  status: 'failed';
  cause: string;
}

interface ServiceEntry {
  plan: readonly Dependency[];
  failedRuns: readonly FailedRunEntry[];
  dependencies: ReadonlyMap<string, Dependency>;
  runs: ReadonlyMap<string, CiRun>;
}

/**
 * The loaded data set, read only. Built once at start: for every service the
 * dependency list is already ordered by name and the failed runs are already
 * newest first, so a read sorts nothing (NFR1.1).
 */
export class DataStore {
  private readonly services = new Map<string, ServiceEntry>();

  constructor(dataSet: SeedDataSet) {
    for (const { serviceName } of dataSet.services) {
      const dependencies = dataSet.dependencies
        .filter(d => d.serviceName === serviceName)
        .sort((a, b) => compareText(a.name, b.name));
      const runs = dataSet.ciRuns.filter(r => r.serviceName === serviceName);
      const failedRuns = runs
        .filter(r => r.status === 'failed')
        .sort((a, b) => b.runNumber - a.runNumber)
        .map((r): FailedRunEntry => ({
          runKey: r.runKey,
          runNumber: r.runNumber,
          status: 'failed',
          cause: r.cause ?? '',
        }));
      this.services.set(serviceName, {
        plan: dependencies,
        failedRuns,
        dependencies: new Map(dependencies.map(d => [d.dependencyKey, d])),
        runs: new Map(runs.map(r => [r.runKey, r])),
      });
    }
  }

  hasService(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  serviceNames(): string[] {
    return [...this.services.keys()];
  }

  plan(serviceName: string): readonly Dependency[] | undefined {
    return this.services.get(serviceName)?.plan;
  }

  failedRuns(serviceName: string): readonly FailedRunEntry[] | undefined {
    return this.services.get(serviceName)?.failedRuns;
  }

  /** The dependency, only when it belongs to this service. */
  dependency(serviceName: string, key: string): Dependency | undefined {
    return this.services.get(serviceName)?.dependencies.get(key);
  }

  /** The run, only when it belongs to this service. */
  run(serviceName: string, key: string): CiRun | undefined {
    return this.services.get(serviceName)?.runs.get(key);
  }
}
