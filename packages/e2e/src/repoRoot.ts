import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Walks up from `start` to the folder whose package.json declares the
 * `packages/*` workspaces. Every command of this package works from there, so
 * the compose file, the env file and the workflow resolve the same way on a
 * laptop and in the pipeline.
 */
export function repoRoot(start: string = process.cwd()): string {
  let dir = start;
  for (;;) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
        if (parsed?.workspaces?.packages) {
          return dir;
        }
      } catch {
        // A package.json that cannot be read is not the root; keep walking.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find the repository root above ${start}: no package.json with workspaces.`,
      );
    }
    dir = parent;
  }
}
