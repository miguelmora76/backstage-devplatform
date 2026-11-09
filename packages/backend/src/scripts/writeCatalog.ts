import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeCatalog } from '../catalog/writeCatalog';

// Thin command-line wrapper; the logic is in ../catalog/writeCatalog.ts.
const generatorCli = join(
  dirname(require.resolve('guardrails-server/package.json')),
  'dist',
  'generator',
  'cli.js',
);

try {
  writeCatalog(process.argv.slice(2), {
    runGenerator: seed =>
      execFileSync(process.execPath, [generatorCli, '--seed', String(seed)], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }),
    writeFile: (path, text) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    },
    print: text => process.stdout.write(text),
  });
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
