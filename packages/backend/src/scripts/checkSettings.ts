import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkShippedSettings } from '../settings/checkShippedSettings';

// Thin command-line wrapper; the check is in ../settings/checkShippedSettings.ts.
// Run from the backend package (`yarn workspace backend check:settings`).
const backendDir = process.cwd();
const read = (path: string) => readFileSync(path, 'utf8');

const findings = checkShippedSettings({
  appConfig: read(join(backendDir, 'app-config.yaml')),
  postgresConfig: read(join(backendDir, 'app-config.postgres.yaml')),
  envExample: read(join(backendDir, '..', '..', '.env.example')),
});

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`[${finding.rule}] ${finding.message}`);
  }
  process.exit(1);
}
console.log('The shipped settings pass every check.');
