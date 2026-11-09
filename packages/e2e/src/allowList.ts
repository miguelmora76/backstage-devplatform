export interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export function parseAllowList(text: string): Set<string> {
  return new Set(
    text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')),
  );
}

/** Names declared in the manifest that the allow-list does not name (NFR5.8). */
export function checkAllowList(
  manifest: Manifest,
  allowedText: string,
): string[] {
  const allowed = parseAllowList(allowedText);
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
  return [...declared].filter(name => !allowed.has(name)).sort();
}
