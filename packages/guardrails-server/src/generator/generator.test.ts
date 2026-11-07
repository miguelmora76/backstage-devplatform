import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_SEED,
  applyRequiredCases,
  checkDataSetLimits,
  checkRequiredCases,
  compareText,
  compareVersions,
  createPrng,
  generateDataSet,
  serializeDataSet,
  verifyDefaultDataSet,
} from './index';
import { generateScaledDataSet } from './scaled';

const SEEDS = [DEFAULT_SEED, 1, 2, 3, 7, 42, 99, 12345, 2 ** 40 + 5, -17];

describe('createPrng', () => {
  it('produces the fixed whole-number sequence for a seed', () => {
    const prng = createPrng(1);
    expect([prng.next(), prng.next(), prng.next()]).toEqual([
      2693262067, 11749833, 2265367787,
    ]);
  });

  it('keeps int() inside its range and is repeatable', () => {
    const a = createPrng(99);
    const b = createPrng(99);
    for (let i = 0; i < 500; i++) {
      const value = a.int(7);
      expect(value).toBe(b.int(7));
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });
});

describe('generateDataSet', () => {
  it('gives identical bytes for the same seed and different bytes for another (BR1.1)', () => {
    for (const seed of SEEDS) {
      expect(serializeDataSet(generateDataSet(seed))).toBe(
        serializeDataSet(generateDataSet(seed)),
      );
    }
    expect(serializeDataSet(generateDataSet(1))).not.toBe(
      serializeDataSet(generateDataSet(2)),
    );
  });

  it('writes the fixed serialization form (BR1.1)', () => {
    const text = serializeDataSet(generateDataSet(DEFAULT_SEED));
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    expect(text).not.toContain('\r');
    expect(text.startsWith('{\n  "seed": ')).toBe(true);
    const topLevelKeys = Object.keys(JSON.parse(text));
    expect(topLevelKeys).toEqual([
      'seed',
      'synthetic',
      'services',
      'dependencies',
      'ciRuns',
    ]);
    const firstDependency = JSON.parse(text).dependencies[0];
    expect(Object.keys(firstDependency)).toEqual([
      'dependencyKey',
      'serviceName',
      'name',
      'currentVersion',
      'recommendedVersion',
    ]);
  });

  it('keeps the default sizes inside the limits for every seed (BR1.2)', () => {
    for (const seed of SEEDS) {
      const data = generateDataSet(seed);
      expect(data.services.length).toBeGreaterThanOrEqual(4);
      expect(data.services.length).toBeLessThanOrEqual(6);
      expect(data.dependencies.length).toBeGreaterThanOrEqual(40);
      expect(data.dependencies.length).toBeLessThanOrEqual(60);
      expect(data.ciRuns.length).toBeGreaterThanOrEqual(80);
      expect(data.ciRuns.length).toBeLessThanOrEqual(120);
      expect(checkDataSetLimits(data)).toEqual([]);
    }
  });

  it('contains the cases the stories test for every seed (BR1.3)', () => {
    for (const seed of SEEDS) {
      const data = generateDataSet(seed);
      expect(checkRequiredCases(data)).toEqual([]);
      const withDeps = new Set(data.dependencies.map(d => d.serviceName));
      expect(data.services.some(s => !withDeps.has(s.serviceName))).toBe(true);
      const withFailed = new Set(
        data.ciRuns.filter(r => r.status === 'failed').map(r => r.serviceName),
      );
      expect(data.services.some(s => !withFailed.has(s.serviceName))).toBe(
        true,
      );
      const current = data.dependencies.filter(
        d => d.currentVersion === d.recommendedVersion,
      );
      expect(current.length).toBeGreaterThanOrEqual(2);
      const causes = new Set(
        data.ciRuns.filter(r => r.status === 'failed').map(r => r.cause),
      );
      expect(causes.size).toBeGreaterThanOrEqual(4);
    }
  });

  it('uses invented realistic names, three-number versions and the synthetic marker (BR1.4)', () => {
    const data = generateDataSet(DEFAULT_SEED);
    expect(data.synthetic).toBe(true);
    for (const service of data.services) {
      expect(service.serviceName).toMatch(/^[a-z]+(-[a-z]+)+$/);
    }
    for (const dependency of data.dependencies) {
      expect(dependency.name).toMatch(/^[a-z]+(-[a-z0-9]+)+$/);
      expect(dependency.currentVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(dependency.recommendedVersion).toMatch(/^\d+\.\d+\.\d+$/);
    }
    const failed = data.ciRuns.filter(r => r.status === 'failed');
    const passed = data.ciRuns.filter(r => r.status === 'passed');
    expect(failed.length).toBeGreaterThan(0);
    for (const run of failed) {
      expect(run.cause).toMatch(/^[a-z]+( [a-z]+)*$/);
    }
    for (const run of passed) {
      expect(run.cause).toBeUndefined();
    }
  });

  it('builds unique keys from the service name and a name or number (BR1.5)', () => {
    for (const seed of SEEDS) {
      const data = generateDataSet(seed);
      const names = data.services.map(s => s.serviceName);
      expect(new Set(names).size).toBe(names.length);
      const depKeys = data.dependencies.map(d => d.dependencyKey);
      expect(new Set(depKeys).size).toBe(depKeys.length);
      for (const d of data.dependencies) {
        expect(d.dependencyKey).toBe(`${d.serviceName}/${d.name}`);
      }
      const runKeys = data.ciRuns.map(r => r.runKey);
      expect(new Set(runKeys).size).toBe(runKeys.length);
      for (const service of names) {
        const numbers = data.ciRuns
          .filter(r => r.serviceName === service)
          .map(r => r.runNumber)
          .sort((a, b) => a - b);
        expect(numbers.length).toBeGreaterThan(0);
        numbers.forEach((n, i) => expect(n).toBe(i + 1));
      }
      for (const r of data.ciRuns) {
        expect(r.runKey).toBe(`${r.serviceName}#${r.runNumber}`);
      }
    }
  });

  it('never recommends a version below the current one (BR1.6)', () => {
    for (const seed of SEEDS) {
      for (const d of generateDataSet(seed).dependencies) {
        expect(
          compareVersions(d.recommendedVersion, d.currentVersion),
        ).toBeGreaterThanOrEqual(0);
      }
    }
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0);
  });

  it('orders every list by code units, not by locale (BR1.1)', () => {
    const cmp = compareText;
    for (const seed of SEEDS) {
      const data = generateDataSet(seed);
      const names = data.services.map(s => s.serviceName);
      expect(names).toEqual([...names].sort(cmp));
      const deps = data.dependencies.map(d => [d.serviceName, d.name]);
      expect(deps).toEqual(
        [...deps].sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1])),
      );
      const runs = data.ciRuns.map(r => [r.serviceName, r.runNumber] as const);
      expect(runs).toEqual(
        [...runs].sort((a, b) => cmp(a[0], b[0]) || a[1] - b[1]),
      );
    }
  });

  it('matches the stored copy of the default data set', () => {
    const stored = fs.readFileSync(
      path.join(__dirname, '..', '..', 'test-data', 'default-data-set.json'),
      'utf8',
    );
    expect(serializeDataSet(generateDataSet(DEFAULT_SEED))).toBe(stored);
  });

  it('builds the default data set within one second (NFR1.3)', () => {
    let slowest = 0;
    for (let i = 0; i < 20; i++) {
      const start = process.hrtime.bigint();
      generateDataSet(DEFAULT_SEED);
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      slowest = Math.max(slowest, ms);
    }
    expect(slowest).toBeLessThanOrEqual(1000);
  });
});

describe('size limits and the test-only size factor', () => {
  it('builds about ten times the data with a factor of 10 (NFR1.5)', () => {
    const large = generateScaledDataSet(DEFAULT_SEED, 10);
    expect(large.services.length).toBeGreaterThanOrEqual(40);
    expect(large.services.length).toBeLessThanOrEqual(60);
    expect(large.dependencies.length).toBeGreaterThanOrEqual(400);
    expect(large.dependencies.length).toBeLessThanOrEqual(600);
    expect(large.ciRuns.length).toBeGreaterThanOrEqual(800);
    expect(large.ciRuns.length).toBeLessThanOrEqual(1200);
    expect(checkRequiredCases(large)).toEqual([]);
    expect(serializeDataSet(large)).toBe(
      serializeDataSet(generateScaledDataSet(DEFAULT_SEED, 10)),
    );
  });

  it('rejects a data set outside the default limits and accepts the default one (BR1.2)', () => {
    const large = generateScaledDataSet(DEFAULT_SEED, 10);
    expect(checkDataSetLimits(large).length).toBeGreaterThan(0);
    expect(() => verifyDefaultDataSet(large)).toThrow(/size limits/);
    expect(() =>
      verifyDefaultDataSet(generateDataSet(DEFAULT_SEED)),
    ).not.toThrow();
  });

  it('reports a missing required case (BR1.3)', () => {
    const data = generateDataSet(DEFAULT_SEED);
    const broken = {
      ...data,
      dependencies: data.dependencies.map(d => ({
        ...d,
        recommendedVersion: '99.0.0',
        currentVersion: '1.0.0',
      })),
    };
    expect(checkRequiredCases(broken).length).toBeGreaterThan(0);
  });

  it('adjusts a draft that lacks the required cases until they are present (BR1.3)', () => {
    const draft = {
      seed: 5,
      synthetic: true as const,
      services: [
        { serviceName: 'a-one' },
        { serviceName: 'b-two' },
        { serviceName: 'c-three' },
        { serviceName: 'd-four' },
      ],
      dependencies: [
        {
          dependencyKey: 'b-two/x-y',
          serviceName: 'b-two',
          name: 'x-y',
          currentVersion: '1.0.0',
          recommendedVersion: '2.0.0',
        },
        {
          dependencyKey: 'b-two/x-z',
          serviceName: 'b-two',
          name: 'x-z',
          currentVersion: '1.0.0',
          recommendedVersion: '1.0.1',
        },
        {
          dependencyKey: 'c-three/x-y',
          serviceName: 'c-three',
          name: 'x-y',
          currentVersion: '3.0.0',
          recommendedVersion: '3.1.0',
        },
      ],
      ciRuns: [1, 2, 3, 4, 5].map(n => ({
        runKey: `b-two#${n}`,
        serviceName: 'b-two',
        runNumber: n,
        status: 'passed' as const,
      })),
    };
    expect(checkRequiredCases(draft).length).toBeGreaterThan(0);
    const fixed = applyRequiredCases(draft, 'a-one', 'd-four');
    expect(checkRequiredCases(fixed)).toEqual([]);
    expect(
      fixed.ciRuns.filter(
        r => r.serviceName === 'd-four' && r.status === 'failed',
      ),
    ).toHaveLength(0);
    expect(serializeDataSet(applyRequiredCases(draft, 'a-one', 'd-four'))).toBe(
      serializeDataSet(fixed),
    );
  });

  it('refuses a size factor that is not a whole number of at least 1', () => {
    expect(() => generateScaledDataSet(1, 0)).toThrow();
    expect(() => generateScaledDataSet(1, 1.5)).toThrow();
  });
});
