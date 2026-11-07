import { generatorCommand } from './command';

/** Prints the data set to standard output; one sentence and exit code 1 on bad arguments. */
export function main(args: readonly string[]): void {
  try {
    process.stdout.write(generatorCommand(args));
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}
