// Checks on the built plugin (dist): no host name or address in the code
// (NFR5.11) and at most 300 KB compressed (NFR1.7). Run after `yarn build`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const LIMIT_BYTES = 300 * 1024;

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const js = files(dist).filter(f => /\.(js|mjs|cjs)$/.test(f));
if (js.length === 0) {
  console.error('dist has no JavaScript; run the build first.');
  process.exit(1);
}

const problems = [];
let gzipped = 0;
for (const file of js) {
  const text = readFileSync(file, 'utf8');
  gzipped += gzipSync(text).length;
  // The plugin writes no host name or address: both base addresses come from
  // Backstage's discovery service.
  for (const pattern of [/https?:\/\//, /localhost/, /127\.0\.0\.1/]) {
    if (pattern.test(text)) {
      problems.push(`${file}: contains ${pattern}`);
    }
  }
}
if (gzipped > LIMIT_BYTES) {
  problems.push(
    `compressed size ${(gzipped / 1024).toFixed(1)} KB is over the 300 KB limit`,
  );
}
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  `Built plugin: ${js.length} files, ${(gzipped / 1024).toFixed(1)} KB compressed, no address.`,
);
