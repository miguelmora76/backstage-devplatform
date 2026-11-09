// Shared by the entries in this folder: builds the TypeScript of packages/e2e
// (the logic lives and is tested in src/) and loads one built module. It has
// no logic of its own beyond that.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
export const root = join(pkg, '..', '..');

export async function load(name) {
  const build = spawnSync('yarn', ['workspace', 'e2e', 'build'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
  return import(pathToFileURL(join(pkg, 'dist', `${name}.js`)).href);
}

/** Runs `action`, prints a plain message and exits non-zero when it throws. */
export async function main(action) {
  try {
    await action();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
