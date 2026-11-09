import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAllDocuments } from 'yaml';

// The committed data the sample starts with: u1's stored default data set
// (seed 20261106) and u4's committed catalog (NFR7.1). Read from the
// repository, so the checks compare the running stack with what is committed.
const packages = join(__dirname, '..', '..', '..');

export interface Dependency {
  dependencyKey: string;
  serviceName: string;
  name: string;
  currentVersion: string;
  recommendedVersion: string;
}
export interface CiRun {
  runKey: string;
  serviceName: string;
  runNumber: number;
  status: string;
  cause?: string;
}

interface DataSet {
  seed: number;
  services: Array<{ serviceName: string }>;
  dependencies: Dependency[];
  ciRuns: CiRun[];
}

const dataSet: DataSet = JSON.parse(
  readFileSync(
    join(packages, 'guardrails-server', 'test-data', 'default-data-set.json'),
    'utf8',
  ),
);

export const seededServices = () => dataSet.services.map(s => s.serviceName);
export const seededDependencies = (service: string) =>
  dataSet.dependencies.filter(d => d.serviceName === service);
export const seededFailedRuns = (service: string) =>
  dataSet.ciRuns.filter(
    r => r.serviceName === service && r.status === 'failed',
  );

/** Kind and name of every entity in u4's committed catalog (ten entities). */
export function committedCatalog(): Array<{ kind: string; name: string }> {
  const text = readFileSync(
    join(packages, 'backend', 'catalog', 'guardrails-catalog.yaml'),
    'utf8',
  );
  return parseAllDocuments(text)
    .map(doc => doc.toJS())
    .filter(Boolean)
    .map(entity => ({ kind: entity.kind, name: entity.metadata.name }));
}
