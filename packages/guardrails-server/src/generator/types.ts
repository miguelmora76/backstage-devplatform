/** Status of a seeded CI run. */
export type CiStatus = 'failed' | 'passed';

/** A synthetic service whose dependencies and CI runs the server reports. */
export interface ServiceRecord {
  serviceName: string;
}

/** A library one service depends on. Keys are opaque text to every caller. */
export interface Dependency {
  dependencyKey: string;
  serviceName: string;
  name: string;
  currentVersion: string;
  recommendedVersion: string;
}

/** One run of a service's CI pipeline. `cause` is present only on seeded failures. */
export interface CiRun {
  runKey: string;
  serviceName: string;
  runNumber: number;
  status: CiStatus;
  cause?: string;
}

/** Everything one seed produces. Every value in it is invented. */
export interface SeedDataSet {
  seed: number;
  synthetic: true;
  services: ServiceRecord[];
  dependencies: Dependency[];
  ciRuns: CiRun[];
}
