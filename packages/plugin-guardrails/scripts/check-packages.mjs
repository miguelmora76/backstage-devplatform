// NFR5.12: the plugin's dependencies are limited to the packages named in
// tech-stack-decisions.md (plus the React, router and type packages the app
// provides). Reads this package's own package.json, so it needs no base branch
// and works the same on pull requests and on pushes to main.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
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
