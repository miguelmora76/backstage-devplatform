import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Fills `${NAME}` and `${NAME:-default}` the way Backstage does; a missing value without a default drops the key. */
function substitute(
  text: string,
  env: Record<string, string>,
): string | undefined {
  let missing = false;
  const result = text.replace(/\$\{([^{}]*)\}/g, (_all, inner: string) => {
    const at = inner.indexOf(':-');
    const name = (at > -1 ? inner.slice(0, at) : inner).trim();
    const fallback = at > -1 ? inner.slice(at + 2).trim() : '';
    const value = env[name] || fallback;
    if (!value) {
      missing = true;
    }
    return value;
  });
  return missing ? undefined : result;
}

function walk(node: Json, env: Record<string, string>): Json | undefined {
  if (typeof node === 'string') {
    return substitute(node, env);
  }
  if (Array.isArray(node)) {
    return node
      .map(item => walk(item, env))
      .filter(v => v !== undefined) as Json[];
  }
  if (node !== null && typeof node === 'object') {
    const out: { [key: string]: Json } = {};
    for (const [key, value] of Object.entries(node)) {
      const filled = walk(value, env);
      if (filled !== undefined) {
        out[key] = filled;
      }
    }
    return out;
  }
  return node;
}

/**
 * The shipped `app-config.yaml` with the environment filled in, so the
 * start-up test runs the real settings (NFR2.3) rather than a copy of them.
 */
export function loadShippedConfig(
  env: Record<string, string>,
  backendDir: string,
): {
  [key: string]: Json;
} {
  const text = readFileSync(join(backendDir, 'app-config.yaml'), 'utf8');
  const config = walk(parse(text) as Json, env) as {
    [key: string]: Json;
  };
  // The catalog location is relative to the folder the backend runs in; the
  // tests may run from the repository root, so point it at the committed file.
  const catalog = config.catalog as { locations?: Array<{ target: string }> };
  if (catalog?.locations?.[0]) {
    catalog.locations[0].target = join(
      backendDir,
      'catalog',
      'guardrails-catalog.yaml',
    );
  }
  return config;
}
