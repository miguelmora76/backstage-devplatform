import { DEFAULT_SEED, generateDataSet } from './generator';
import { serializeDataSet } from './serialize';

const USAGE = 'Usage: generate [--seed <whole number>]';

/**
 * The command-line mode of the generator (W6): returns the data set in its
 * fixed form so two runs can be compared byte for byte. It is the same
 * function the server calls at start-up; it never reads the clock.
 */
export function generatorCommand(args: readonly string[]): string {
  let seedText: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed') {
      i += 1;
      seedText = args[i];
    } else if (arg.startsWith('--seed=')) {
      seedText = arg.slice('--seed='.length);
    } else {
      throw new Error(USAGE);
    }
    if (seedText === undefined || !/^-?\d+$/.test(seedText)) {
      throw new Error(USAGE);
    }
  }
  const seed = seedText === undefined ? DEFAULT_SEED : Number(seedText);
  if (!Number.isSafeInteger(seed)) {
    throw new Error(USAGE);
  }
  return serializeDataSet(generateDataSet(seed));
}
