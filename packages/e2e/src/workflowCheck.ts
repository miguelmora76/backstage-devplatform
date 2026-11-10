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

const DOWNLOADS = [
  {
    tool: 'minikube',
    marker: /minikube-linux-amd64/,
    exact: /releases\/download\/v\d+\.\d+\.\d+\/minikube-linux-amd64/,
  },
  {
    tool: 'kubectl',
    marker: /dl\.k8s\.io/,
    exact: /dl\.k8s\.io\/release\/v\d+\.\d+\.\d+\/bin\/linux\/amd64\/kubectl/,
  },
];

/**
 * The rules for the job `minikube-e2e` of u6-minikube-run: NFR2.21 (it exists,
 * needs app-image, has the 35-minute limit), NFR5.18 (each downloaded tool at
 * an exact version, checked with `sha256sum -c` against a written digest),
 * NFR2.23 (the sample is always stopped), NFR2.24 and NFR1.5 (the two
 * switches are set here and only here). The generic rules (only actions/*, no
 * login, push or deploy, no secrets, a time limit, ci-ok) run over this job
 * like any other.
 */
function checkMinikubeJob(jobs: Json): string[] {
  const job = jobs['minikube-e2e'];
  const problems: string[] = [];
  const composeSteps = JSON.stringify(jobs['compose-e2e']?.steps ?? []);
  if (/E2E_TIMING_BLOCKING|E2E_STACK/.test(composeSteps)) {
    problems.push(
      'NFR1.5: compose-e2e must not set E2E_TIMING_BLOCKING or E2E_STACK; the timing check stays blocking there.',
    );
  }
  if (!job) {
    problems.push('NFR2.21: the workflow needs the job minikube-e2e.');
    return problems;
  }
  if (JSON.stringify([job.needs].flat()) !== '["app-image"]') {
    problems.push('NFR2.21: minikube-e2e must have needs app-image.');
  }
  if (job['runs-on'] !== 'ubuntu-latest') {
    problems.push('NFR2.21: minikube-e2e must run on ubuntu-latest.');
  }
  if (job['timeout-minutes'] !== 35) {
    problems.push('NFR2.21: minikube-e2e must set timeout-minutes: 35.');
  }

  const steps: Json[] = job.steps ?? [];
  const downloads = steps.filter(step =>
    /\bcurl\b|\bwget\b/.test(String(step.run ?? '')),
  );
  for (const wanted of DOWNLOADS) {
    const step = downloads.find(s => wanted.marker.test(String(s.run)));
    if (!step) {
      problems.push(
        `NFR5.18: minikube-e2e must download ${wanted.tool} at an exact version.`,
      );
      continue;
    }
    const run = String(step.run);
    if (!wanted.exact.test(run)) {
      problems.push(
        `NFR5.18: the ${wanted.tool} download must name an exact version, not a moving one.`,
      );
    }
    if (!/sha256sum -c/.test(run) || !/\b[0-9a-f]{64}\b/.test(run)) {
      problems.push(
        `NFR5.18: the ${wanted.tool} download must be checked with sha256sum -c against a written 64-digit digest.`,
      );
    }
  }

  const text = JSON.stringify(steps);
  if (!text.includes('E2E_STACK=minikube')) {
    problems.push(
      'NFR2.24: minikube-e2e must run the specs with E2E_STACK=minikube.',
    );
  }
  if (!text.includes('E2E_TIMING_BLOCKING=false')) {
    problems.push(
      'NFR1.5: minikube-e2e must run the timing check with E2E_TIMING_BLOCKING=false.',
    );
  }
  if (
    !steps.some(
      s =>
        s.if === 'always()' && /yarn minikube:down/.test(String(s.run ?? '')),
    )
  ) {
    problems.push(
      'NFR2.23: minikube-e2e must always stop the sample (a yarn minikube:down step with if: always()).',
    );
  }
  return problems;
}

/** Checks the workflow against NFR2.4, NFR5.2, NFR5.4, NFR5.9 and the minikube job's rules. */
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
  problems.push(...checkMinikubeJob(jobs));

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
