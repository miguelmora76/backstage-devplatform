import { createPrng, type Prng } from './prng';
import type { CiRun, Dependency, SeedDataSet } from './types';
import { compareText } from './versions';

/** The fixed default seed: a plain start gives the same demo every time. */
export const DEFAULT_SEED = 20261106;

const SERVICE_ADJECTIVES = [
  'checkout',
  'billing',
  'catalog',
  'orders',
  'payments',
  'search',
  'shipping',
  'inventory',
  'pricing',
  'identity',
  'reports',
  'alerts',
  'media',
  'profile',
  'notify',
] as const;

const SERVICE_NOUNS = [
  'api',
  'gateway',
  'worker',
  'portal',
  'engine',
  'service',
  'proxy',
  'hub',
  'sync',
  'feed',
  'store',
  'router',
  'scheduler',
  'bridge',
  'console',
] as const;

const PACKAGE_PREFIXES = [
  'zeno',
  'quill',
  'brisk',
  'nimbus',
  'tango',
  'orbit',
  'kestrel',
  'lumen',
  'pebble',
  'cobalt',
  'ember',
  'falcon',
  'glint',
  'harbor',
  'juniper',
  'krypton',
  'maple',
  'nova',
  'onyx',
  'prism',
] as const;

const PACKAGE_SUFFIXES = [
  'pad',
  'parse',
  'cache',
  'queue',
  'log',
  'hash',
  'merge',
  'trace',
  'route',
  'format',
  'retry',
  'guard',
  'mock',
  'stream',
  'schema',
  'render',
  'watch',
  'bundle',
  'sync',
  'clock',
] as const;

/** Everyday phrases for why a run failed (BR1.4). */
export const FAILURE_CAUSES = [
  'failing test',
  'lint error',
  'dependency conflict',
  'flaky timeout',
  'build cache',
  'out of memory',
] as const;

const MIN_DISTINCT_CAUSES = 4;
const MIN_FAILED_RUNS = 4;
const MIN_CURRENT_DEPENDENCIES = 2;
const FAILED_RUN_PERCENT = 30;

const DEFAULT_LIMITS = {
  services: [4, 6],
  dependencies: [40, 60],
  ciRuns: [80, 120],
} as const;

/** Splits `total` over the weights; the leftover goes to the earliest entries. */
function distribute(total: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const counts = weights.map(w => Math.floor((total * w) / weightSum));
  let leftover = total - counts.reduce((sum, c) => sum + c, 0);
  for (let i = 0; leftover > 0; i = (i + 1) % counts.length) {
    counts[i] += 1;
    leftover -= 1;
  }
  return counts;
}

function buildVersions(prng: Prng): { current: string; recommended: string } {
  const major = prng.int(6);
  const minor = prng.int(20);
  const patch = prng.int(30);
  const roll = prng.int(10);
  const patchBump = 1 + prng.int(5);
  const minorBump = 1 + prng.int(4);
  const current = `${major}.${minor}.${patch}`;
  let recommended = current;
  if (roll >= 9) {
    recommended = `${major + 1}.0.0`;
  } else if (roll >= 7) {
    recommended = `${major}.${minor + minorBump}.0`;
  } else if (roll >= 3) {
    recommended = `${major}.${minor}.${patch + patchBump}`;
  }
  return { current, recommended };
}

function buildServiceNames(prng: Prng, count: number): string[] {
  const combinations: string[] = [];
  for (const adjective of SERVICE_ADJECTIVES) {
    for (const noun of SERVICE_NOUNS) {
      combinations.push(`${adjective}-${noun}`);
    }
  }
  return prng.sample(combinations, count).sort(compareText);
}

function buildDependencies(
  prng: Prng,
  serviceName: string,
  count: number,
): Dependency[] {
  const names: string[] = [];
  for (const prefix of PACKAGE_PREFIXES) {
    for (const suffix of PACKAGE_SUFFIXES) {
      names.push(`${prefix}-${suffix}`);
    }
  }
  return prng
    .sample(names, count)
    .sort(compareText)
    .map(name => {
      const { current, recommended } = buildVersions(prng);
      return {
        dependencyKey: `${serviceName}/${name}`,
        serviceName,
        name,
        currentVersion: current,
        recommendedVersion: recommended,
      };
    });
}

function buildRuns(
  prng: Prng,
  serviceName: string,
  count: number,
  canFail: boolean,
): CiRun[] {
  const runs: CiRun[] = [];
  for (let runNumber = 1; runNumber <= count; runNumber++) {
    const failed = prng.int(100) < FAILED_RUN_PERCENT;
    const cause = FAILURE_CAUSES[prng.int(FAILURE_CAUSES.length)];
    const base = {
      runKey: `${serviceName}#${runNumber}`,
      serviceName,
      runNumber,
    };
    runs.push(
      canFail && failed
        ? { ...base, status: 'failed', cause }
        : { ...base, status: 'passed' },
    );
  }
  return runs;
}

/** Lists what is wrong with the sizes of a data set (BR1.2). Empty means fine. */
export function checkDataSetLimits(dataSet: SeedDataSet): string[] {
  const problems: string[] = [];
  const checks: Array<[string, number, readonly [number, number]]> = [
    ['services', dataSet.services.length, DEFAULT_LIMITS.services],
    ['dependencies', dataSet.dependencies.length, DEFAULT_LIMITS.dependencies],
    ['ciRuns', dataSet.ciRuns.length, DEFAULT_LIMITS.ciRuns],
  ];
  for (const [label, count, [min, max]] of checks) {
    if (count < min || count > max) {
      problems.push(`${label} is ${count}, expected ${min} to ${max}`);
    }
  }
  return problems;
}

/** Lists the required cases a data set lacks (BR1.3). Empty means fine. */
export function checkRequiredCases(dataSet: SeedDataSet): string[] {
  const problems: string[] = [];
  const withDependencies = new Set(
    dataSet.dependencies.map(d => d.serviceName),
  );
  if (dataSet.services.every(s => withDependencies.has(s.serviceName))) {
    problems.push('no service without dependencies');
  }
  const failedRuns = dataSet.ciRuns.filter(r => r.status === 'failed');
  const withFailed = new Set(failedRuns.map(r => r.serviceName));
  if (dataSet.services.every(s => withFailed.has(s.serviceName))) {
    problems.push('no service without failed runs');
  }
  const current = dataSet.dependencies.filter(
    d => d.currentVersion === d.recommendedVersion,
  );
  if (current.length < MIN_CURRENT_DEPENDENCIES) {
    problems.push('fewer than two dependencies already current');
  }
  if (new Set(failedRuns.map(r => r.cause)).size < MIN_DISTINCT_CAUSES) {
    problems.push('fewer than four different failure causes');
  }
  return problems;
}

/**
 * Adjusts a data set until the required cases are present (BR1.3). The same
 * input always gives the same output. `noDependencies` and `noFailedRuns`
 * name the two services that carry the empty cases; nothing is changed on
 * them.
 */
export function applyRequiredCases(
  dataSet: SeedDataSet,
  noDependencies: string,
  noFailedRuns: string,
): SeedDataSet {
  const dependencies = dataSet.dependencies.map(d => ({ ...d }));
  const ciRuns = dataSet.ciRuns.map(r => ({ ...r }));

  let current = dependencies.filter(
    d => d.currentVersion === d.recommendedVersion,
  ).length;
  for (const dependency of dependencies) {
    if (current >= MIN_CURRENT_DEPENDENCIES) {
      break;
    }
    if (dependency.currentVersion !== dependency.recommendedVersion) {
      dependency.recommendedVersion = dependency.currentVersion;
      current += 1;
    }
  }

  const failed = (): CiRun[] => ciRuns.filter(r => r.status === 'failed');
  for (const run of ciRuns) {
    if (failed().length >= MIN_FAILED_RUNS) {
      break;
    }
    if (run.status === 'passed' && run.serviceName !== noFailedRuns) {
      run.status = 'failed';
      run.cause = FAILURE_CAUSES[failed().length % FAILURE_CAUSES.length];
    }
  }

  const causeCounts = new Map<string, number>();
  for (const run of failed()) {
    causeCounts.set(
      run.cause ?? '',
      (causeCounts.get(run.cause ?? '') ?? 0) + 1,
    );
  }
  for (const run of failed()) {
    if (causeCounts.size >= MIN_DISTINCT_CAUSES) {
      break;
    }
    const old = run.cause ?? '';
    if ((causeCounts.get(old) ?? 0) > 1) {
      const missing = FAILURE_CAUSES.find(c => !causeCounts.has(c));
      if (missing !== undefined) {
        causeCounts.set(old, (causeCounts.get(old) ?? 0) - 1);
        causeCounts.set(missing, 1);
        run.cause = missing;
      }
    }
  }

  return {
    ...dataSet,
    services: dataSet.services.map(s => ({ ...s })),
    dependencies: dependencies.filter(d => d.serviceName !== noDependencies),
    ciRuns,
  };
}

/** Throws if a data set breaks the default size limits or lacks a required case. */
export function verifyDefaultDataSet(dataSet: SeedDataSet): void {
  const problems = [
    ...checkDataSetLimits(dataSet),
    ...checkRequiredCases(dataSet),
  ];
  if (problems.length > 0) {
    throw new Error(
      `The generated data set breaks the size limits or the required cases: ${problems.join('; ')}`,
    );
  }
}

export function buildDataSet(seed: number, factor: number): SeedDataSet {
  const prng = createPrng(seed);
  const serviceCount = (4 + prng.int(3)) * factor;
  const dependencyTotal = (40 + prng.int(21)) * factor;
  const runTotal = (80 + prng.int(41)) * factor;

  const serviceNames = buildServiceNames(prng, serviceCount);
  const noDependencies = serviceNames[prng.int(serviceCount)];
  const noFailedRuns =
    serviceNames[
      (serviceNames.indexOf(noDependencies) + 1 + prng.int(serviceCount - 1)) %
        serviceCount
    ];

  const withDependencies = serviceNames.filter(s => s !== noDependencies);
  const dependencyCounts = distribute(
    dependencyTotal,
    withDependencies.map(() => 1 + prng.int(3)),
  );
  const runCounts = distribute(
    runTotal,
    serviceNames.map(() => 1 + prng.int(3)),
  );

  const dependencies = withDependencies.flatMap((name, i) =>
    buildDependencies(prng, name, dependencyCounts[i]),
  );
  const ciRuns = serviceNames.flatMap((name, i) =>
    buildRuns(prng, name, runCounts[i], name !== noFailedRuns),
  );

  return applyRequiredCases(
    {
      seed,
      synthetic: true,
      services: serviceNames.map(serviceName => ({ serviceName })),
      dependencies,
      ciRuns,
    },
    noDependencies,
    noFailedRuns,
  );
}

/**
 * The default-size entry point, the only one the server's start-up path
 * calls. It enforces the size limits (BR1.2) and the required cases (BR1.3).
 */
export function generateDataSet(seed: number = DEFAULT_SEED): SeedDataSet {
  const dataSet = buildDataSet(seed, 1);
  verifyDefaultDataSet(dataSet);
  return dataSet;
}
