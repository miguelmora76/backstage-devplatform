import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAllDocuments } from 'yaml';
import {
  DEFAULT_SEED,
  generateDataSet,
  serializeDataSet,
} from 'guardrails-server';
import {
  buildCatalog,
  catalogFromDataSet,
  parseCatalogArgs,
  serializeCatalog,
  serviceNamesFromDataSet,
} from './buildCatalog';

const COMMITTED = join(
  __dirname,
  '..',
  '..',
  'catalog',
  'guardrails-catalog.yaml',
);

function dataSetJson(seed: number): string {
  return serializeDataSet(generateDataSet(seed));
}

describe('buildCatalog', () => {
  const names = serviceNamesFromDataSet(dataSetJson(DEFAULT_SEED));

  it('holds ten entries: six services, three demo users and one group (BR3.1, BR3.3)', () => {
    const entities = buildCatalog(names);
    const kinds = entities.map(entity => entity.kind);
    expect(entities).toHaveLength(10);
    expect(kinds.filter(kind => kind === 'Component')).toHaveLength(6);
    expect(kinds.filter(kind => kind === 'User')).toHaveLength(3);
    expect(kinds.filter(kind => kind === 'Group')).toHaveLength(1);
  });

  it('names each Component as the seed names its service and adds no other (BR3.1)', () => {
    const entities = buildCatalog(names);
    const components = entities
      .filter(entity => entity.kind === 'Component')
      .map(entity => entity.metadata.name)
      .sort();
    expect(components).toEqual([...names].sort());
  });

  it('gives every service the owner group and the group the three demo users (BR3.3)', () => {
    const entities = buildCatalog(names);
    for (const entity of entities.filter(e => e.kind === 'Component')) {
      expect(entity.spec).toMatchObject({
        type: 'service',
        lifecycle: 'experimental',
        owner: 'group:default/guardrails-demo',
      });
    }
    const users = entities.filter(entity => entity.kind === 'User');
    expect(users.map(user => user.metadata.name)).toEqual([
      'alex',
      'priya',
      'sam',
    ]);
    for (const user of users) {
      expect(user.spec).toMatchObject({ memberOf: ['guardrails-demo'] });
    }
  });

  it('is identical on two runs and ignores the order of the names (NFR7.1)', () => {
    const first = serializeCatalog(buildCatalog(names));
    const second = serializeCatalog(buildCatalog([...names].reverse()));
    expect(second).toBe(first);
  });

  it('refuses a data set with no services or an unusable name (BR3.1)', () => {
    expect(() => buildCatalog([])).toThrow(/no services/i);
    expect(() => buildCatalog(['Bad Name'])).toThrow(/Bad Name/);
  });

  it('reads the service names from the generator output and refuses anything else (BR3.2)', () => {
    expect(names.length).toBe(6);
    expect(() => serviceNamesFromDataSet('not json')).toThrow(/data set/i);
    expect(() => serviceNamesFromDataSet('{"services":"x"}')).toThrow(
      /data set/i,
    );
  });

  it('writes the same file as the committed catalog for the default seed (BR3.2, NFR2.4)', () => {
    const output = catalogFromDataSet(dataSetJson(DEFAULT_SEED));
    expect(readFileSync(COMMITTED, 'utf8')).toBe(output);
    const documents = parseAllDocuments(output).map(doc => doc.toJS());
    expect(documents).toHaveLength(10);
  });

  it('parses the script arguments: default seed, --seed, --out and bad input (BR3.5)', () => {
    expect(parseCatalogArgs([])).toEqual({
      seed: DEFAULT_SEED,
      out: undefined,
    });
    expect(parseCatalogArgs(['--seed', '7', '--out', 'x.yaml'])).toEqual({
      seed: 7,
      out: 'x.yaml',
    });
    expect(parseCatalogArgs(['--seed=9'])).toEqual({ seed: 9, out: undefined });
    expect(() => parseCatalogArgs(['--seed', 'abc'])).toThrow(/Usage/);
    expect(() => parseCatalogArgs(['--other'])).toThrow(/Usage/);
  });
});
