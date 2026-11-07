import type { SeedDataSet } from './types';

/**
 * Writes the data set in its one fixed form (BR1.1): fixed field order, the
 * lists as given (the generator orders them), a two-space indent, line-feed
 * endings and one trailing line feed.
 */
export function serializeDataSet(dataSet: SeedDataSet): string {
  const ordered = {
    seed: dataSet.seed,
    synthetic: dataSet.synthetic,
    services: dataSet.services.map(s => ({ serviceName: s.serviceName })),
    dependencies: dataSet.dependencies.map(d => ({
      dependencyKey: d.dependencyKey,
      serviceName: d.serviceName,
      name: d.name,
      currentVersion: d.currentVersion,
      recommendedVersion: d.recommendedVersion,
    })),
    ciRuns: dataSet.ciRuns.map(r =>
      r.cause === undefined
        ? {
            runKey: r.runKey,
            serviceName: r.serviceName,
            runNumber: r.runNumber,
            status: r.status,
          }
        : {
            runKey: r.runKey,
            serviceName: r.serviceName,
            runNumber: r.runNumber,
            status: r.status,
            cause: r.cause,
          },
    ),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
