// NFR5.8: a package's dependencies are limited to the packages named in
// tech-stack-decisions.md. Reads the package.json and allowed-packages.txt of
// the folder given as the first argument (default: the backend package), so it
// needs no base branch and works the same on pull requests and on pushes to
// main. The app package runs this same script (`yarn workspace app check:packages`).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2]
  ? resolve(process.argv[2])
  : join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const allowed = new Set(
  readFileSync(join(root, 'allowed-packages.txt'), 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')),
);

const declared = new Set([
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
]);
const extra = [...declared].filter(name => !allowed.has(name)).sort();

if (extra.length > 0) {
  console.error(
    `Packages not in allowed-packages.txt: ${extra.join(', ')}.\n` +
      'If a package is added on purpose, add it to allowed-packages.txt in the same pull request.',
  );
  process.exit(1);
}
console.log(`All ${declared.size} declared packages are allowed.`);
