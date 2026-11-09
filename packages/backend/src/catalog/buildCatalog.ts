import { stringify } from 'yaml';

/** The default seed of the guardrails server's generator (contract C4). */
export const DEFAULT_CATALOG_SEED = 20261106;

const API_VERSION = 'backstage.io/v1alpha1';
const OWNER_GROUP = 'guardrails-demo';
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** The three invented demo users of contract C3, in catalog order. */
const DEMO_USERS = [
  { name: 'alex', displayName: 'Alex' },
  { name: 'priya', displayName: 'Priya' },
  { name: 'sam', displayName: 'Sam' },
] as const;

export interface CatalogEntity {
  apiVersion: string;
  kind: 'Component' | 'User' | 'Group';
  metadata: { name: string; description?: string };
  spec: Record<string, unknown>;
}

/**
 * Builds the ten catalog entries (BR3.1, BR3.3): one owner group, the three
 * demo users and one service Component for each name. The order is fixed
 * (group, users, services by name), so two runs give the same file (NFR7.1).
 */
export function buildCatalog(serviceNames: readonly string[]): CatalogEntity[] {
  if (serviceNames.length === 0) {
    throw new Error(
      'The data set has no services, so there is nothing to list.',
    );
  }
  for (const name of serviceNames) {
    if (!NAME_PATTERN.test(name)) {
      throw new Error(
        `The service name "${name}" cannot be used as a catalog name (lower-case words joined by hyphens).`,
      );
    }
  }
  const group: CatalogEntity = {
    apiVersion: API_VERSION,
    kind: 'Group',
    metadata: {
      name: OWNER_GROUP,
      description: 'Owner of the synthetic services.',
    },
    spec: { type: 'team', children: [] },
  };
  const users: CatalogEntity[] = DEMO_USERS.map(user => ({
    apiVersion: API_VERSION,
    kind: 'User',
    metadata: { name: user.name },
    spec: {
      profile: { displayName: user.displayName },
      memberOf: [OWNER_GROUP],
    },
  }));
  const services: CatalogEntity[] = [...serviceNames].sort().map(name => ({
    apiVersion: API_VERSION,
    kind: 'Component',
    metadata: {
      name,
      description: 'A synthetic service for the guardrails sample.',
    },
    spec: {
      type: 'service',
      lifecycle: 'experimental',
      owner: `group:default/${OWNER_GROUP}`,
    },
  }));
  return [group, ...users, ...services];
}

const HEADER =
  '# Written by the catalog script (yarn workspace backend catalog:write).\n' +
  '# Do not edit by hand: a test fails when this file differs from the script output\n' +
  '# for the default seed.\n';

/** Writes the entries as one YAML document each. */
export function serializeCatalog(entities: readonly CatalogEntity[]): string {
  const documents = entities.map(entity =>
    stringify(entity, { lineWidth: 0, sortMapEntries: false }),
  );
  return `${HEADER}---\n${documents.join('---\n')}`;
}

/** Reads the `serviceName` of each service in the generator's output. */
export function serviceNamesFromDataSet(json: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('The data set is not valid JSON.');
  }
  const services = (parsed as { services?: unknown } | null)?.services;
  if (!Array.isArray(services)) {
    throw new Error('The data set has no services list.');
  }
  return services.map(service => {
    const name = (service as { serviceName?: unknown } | null)?.serviceName;
    if (typeof name !== 'string') {
      throw new Error('The data set has a service without a name.');
    }
    return name;
  });
}

/** The whole catalog file for a data set given as the generator prints it. */
export function catalogFromDataSet(json: string): string {
  return serializeCatalog(buildCatalog(serviceNamesFromDataSet(json)));
}

export interface CatalogArgs {
  seed: number;
  out: string | undefined;
}

const USAGE = 'Usage: write-catalog [--seed <whole number>] [--out <file>]';

/** Reads `--seed` and `--out` (BR3.5); one sentence on bad input. */
export function parseCatalogArgs(args: readonly string[]): CatalogArgs {
  let seedText: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed') {
      i += 1;
      seedText = args[i];
    } else if (arg.startsWith('--seed=')) {
      seedText = arg.slice('--seed='.length);
    } else if (arg === '--out') {
      i += 1;
      out = args[i];
    } else if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length);
    } else {
      throw new Error(USAGE);
    }
  }
  if (seedText !== undefined && !/^-?\d+$/.test(seedText)) {
    throw new Error(USAGE);
  }
  const seed = seedText === undefined ? DEFAULT_CATALOG_SEED : Number(seedText);
  if (!Number.isSafeInteger(seed) || (out !== undefined && out === '')) {
    throw new Error(USAGE);
  }
  return { seed, out };
}
