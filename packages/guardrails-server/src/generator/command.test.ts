import * as fs from 'node:fs';
import * as path from 'node:path';
import { generatorCommand } from './command';
import { DEFAULT_SEED, generateDataSet, serializeDataSet } from './index';

describe('generatorCommand', () => {
  it('prints identical output on two runs (US6.1, AC6.1.3)', () => {
    expect(generatorCommand([])).toBe(generatorCommand([]));
    expect(generatorCommand(['--seed', '77'])).toBe(
      generatorCommand(['--seed', '77']),
    );
  });

  it('prints the stored default data set when no seed is given', () => {
    const stored = fs.readFileSync(
      path.join(__dirname, '..', '..', 'test-data', 'default-data-set.json'),
      'utf8',
    );
    expect(generatorCommand([])).toBe(stored);
    expect(generatorCommand(['--seed', String(DEFAULT_SEED)])).toBe(stored);
  });

  it('prints the data set of the seed it is given', () => {
    expect(generatorCommand(['--seed', '77'])).toBe(
      serializeDataSet(generateDataSet(77)),
    );
    expect(generatorCommand(['--seed=77'])).toBe(
      serializeDataSet(generateDataSet(77)),
    );
    expect(generatorCommand(['--seed', '77'])).not.toBe(generatorCommand([]));
  });

  it.each([
    [['--seed']],
    [['--seed', 'abc']],
    [['--seed', '1.5']],
    [['--seed=']],
    [['--nope']],
    [['extra']],
  ])('refuses the arguments %j with one sentence', args => {
    expect(() => generatorCommand(args)).toThrow(
      'Usage: generate [--seed <whole number>]',
    );
  });
});
