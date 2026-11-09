import { writeCatalog } from './writeCatalog';

const DATA_SET = JSON.stringify({
  services: [{ serviceName: 'orders' }, { serviceName: 'billing' }],
});

describe('writeCatalog', () => {
  it('prints the catalog when no output file is given', () => {
    const printed: string[] = [];
    writeCatalog([], {
      runGenerator: () => DATA_SET,
      writeFile: () => {
        throw new Error('should not write');
      },
      print: text => printed.push(text),
    });
    expect(printed).toHaveLength(1);
    expect(printed[0]).toContain('name: billing');
    expect(printed[0]).toContain('name: orders');
  });

  it('writes the catalog to --out and asks the generator for the chosen seed', () => {
    const seeds: number[] = [];
    const written: Array<[string, string]> = [];
    writeCatalog(['--seed', '5', '--out', 'x.yaml'], {
      runGenerator: seed => {
        seeds.push(seed);
        return DATA_SET;
      },
      writeFile: (path, text) => written.push([path, text]),
      print: () => {
        throw new Error('should not print');
      },
    });
    expect(seeds).toEqual([5]);
    expect(written[0][0]).toBe('x.yaml');
    expect(written[0][1]).toContain('kind: Component');
  });

  it('stops on bad arguments or a generator answer it cannot read', () => {
    const deps = {
      runGenerator: () => 'oops',
      writeFile: () => undefined,
      print: () => undefined,
    };
    expect(() => writeCatalog(['--nope'], deps)).toThrow(/Usage/);
    expect(() => writeCatalog([], deps)).toThrow(/data set/i);
  });
});
