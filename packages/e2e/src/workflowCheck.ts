import { findLiteralSecrets, SecretExemption } from './secretCheck';

/**
 * The named exemption of the secret test: the throw-away login that the two
 * plugin jobs give their PostgreSQL service container. Valid only inside the
 * job; any other literal fails.
 */
export const SECRET_EXEMPTIONS: SecretExemption[] = [
  { key: 'POSTGRES_PASSWORD', value: 'postgres' },
  {
    key: 'BACKSTAGE_TEST_DATABASE_POSTGRES16_CONNECTION_STRING',
    value: 'postgresql://postgres:postgres@localhost:5432/postgres',
  },
];

type Json = Record<string, any>;

const EXACT_TAG = /^[\w./-]+:\d+\.\d+(\.\d+)?(-[\w.]+)?$/;

/** Checks the workflow against NFR2.4, NFR5.2, NFR5.4 and NFR5.9. */
export function checkWorkflow(
  doc: unknown,
  text: string,
  compose: unknown,
): string[] {
  const root = (doc ?? {}) as Json;
  const jobs: Json = root.jobs ?? {};
  const problems: string[] = [];
  if (Object.keys(jobs).length === 0) {
    return ['NFR2.4: the workflow has no jobs.'];
  }

  if (JSON.stringify(root.permissions) !== '{"contents":"read"}') {
    problems.push(
      'NFR5.9: top-level permissions must be exactly contents: read.',
    );
  }
  if (/pull_request_target/.test(text)) {
    problems.push('NFR5.9: the workflow must not use pull_request_target.');
  }
  const on = root.on ?? {};
  if (
    !('pull_request' in on) ||
    JSON.stringify(on.push?.branches) !== '["main"]'
  ) {
    problems.push(
      'NFR2.4: the workflow must run on pull_request and on push to main.',
    );
  }
  if (/docker\s+(login|push)|\bdeploy\b\s*:|run:.*\bdeploy\b/.test(text)) {
    problems.push(
      'NFR5.9: no step may run docker login, docker push or a deploy.',
    );
  }
  if (/secrets\./.test(text)) {
    problems.push(
      'NFR5.2: the workflow must not use secrets.* (no repository secret).',
    );
  }

  const composeTag = (compose as Json | null)?.services?.postgres?.image;
  for (const [name, job] of Object.entries<Json>(jobs)) {
    if (job.permissions !== undefined) {
      problems.push(`NFR5.9: job ${name} must not set its own permissions.`);
    }
    if (typeof job['timeout-minutes'] !== 'number') {
      problems.push(`NFR5.9: job ${name} needs a timeout-minutes limit.`);
    }
    for (const step of job.steps ?? []) {
      const uses: string | undefined = step.uses;
      if (uses && !/^actions\/[\w-]+@v\d+$/.test(uses)) {
        problems.push(
          `NFR5.4: step uses ${uses}, which is not an actions/* action at a major version.`,
        );
      }
    }
    for (const service of Object.values<Json>(job.services ?? {})) {
      const image: string = service.image;
      if (!EXACT_TAG.test(image)) {
        problems.push(
          `NFR5.4: job ${name} uses ${image}, which is not an exact version tag.`,
        );
      } else if (composeTag && image !== composeTag) {
        problems.push(
          `NFR5.4: job ${name} uses ${image}, not the compose tag ${composeTag}.`,
        );
      }
    }
  }

  problems.push(...findLiteralSecrets(root, SECRET_EXEMPTIONS));

  const ciOk = jobs['ci-ok'];
  if (!ciOk) {
    problems.push('NFR2.4: the workflow needs a ci-ok job.');
  } else {
    const needs: string[] = ciOk.needs ?? [];
    for (const other of Object.keys(jobs).filter(n => n !== 'ci-ok')) {
      if (!needs.includes(other)) {
        problems.push(`NFR2.4: ci-ok does not need job ${other}.`);
      }
    }
    if (ciOk.if !== 'always()') {
      problems.push('NFR2.4: ci-ok must run with if: always().');
    }
  }
  return problems;
}
