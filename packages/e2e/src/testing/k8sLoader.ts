import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, parseAllDocuments } from 'yaml';
import type { K8sInput } from '../k8sCheck';

/**
 * Reads `k8s/kustomization.yaml` and follows its `resources:` list, with the
 * `yaml` package: no `kubectl` is needed (NFR2.20). It lives with the test
 * support because only the unit tests read the files; the rules themselves
 * (src/k8sCheck.ts) take parsed YAML and need no parser.
 */
export function loadK8s(
  root: string,
): Pick<K8sInput, 'kustomization' | 'docs'> {
  const file = join(root, 'k8s', 'kustomization.yaml');
  if (!existsSync(file)) {
    throw new Error(`Cannot read ${file}: no such file.`);
  }
  const kustomization = parse(readFileSync(file, 'utf8')) as Record<
    string,
    any
  >;
  const docs: Array<Record<string, any>> = [];
  for (const resource of kustomization?.resources ?? []) {
    const path = join(root, 'k8s', resource);
    if (!existsSync(path)) {
      throw new Error(
        `k8s/kustomization.yaml lists ${resource}, but ${path} does not exist.`,
      );
    }
    for (const document of parseAllDocuments(readFileSync(path, 'utf8'))) {
      if (document.errors.length > 0) {
        throw new Error(
          `${resource} is not valid YAML: ${document.errors[0].message}`,
        );
      }
      const value = document.toJS();
      if (value) docs.push(value);
    }
  }
  return { kustomization, docs };
}
