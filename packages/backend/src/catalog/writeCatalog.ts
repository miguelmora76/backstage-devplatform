import { catalogFromDataSet, parseCatalogArgs } from './buildCatalog';

export interface WriteCatalogDeps {
  /** Returns the generator's output (JSON text) for a seed. */
  runGenerator(seed: number): string;
  /** Writes the catalog file. */
  writeFile(path: string, text: string): void;
  /** Prints to standard output. */
  print(text: string): void;
}

/**
 * The catalog script (W5): prints the catalog file for a seed, or writes it to
 * `--out`. It asks the u1 generator for the data, so the catalog always follows
 * the data (BR3.2).
 */
export function writeCatalog(
  args: readonly string[],
  deps: WriteCatalogDeps,
): void {
  const { seed, out } = parseCatalogArgs(args);
  const text = catalogFromDataSet(deps.runGenerator(seed));
  if (out) {
    deps.writeFile(out, text);
  } else {
    deps.print(text);
  }
}
