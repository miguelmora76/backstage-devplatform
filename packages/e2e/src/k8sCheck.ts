import { SECRET_NAME } from './dbSecret';
import { SEED } from './envFile';
import { APP_IMAGE, SERVER_IMAGE } from './imageBuild';
import { NAMESPACE } from './minikubeArgs';
import { findLiteralSecrets } from './secretCheck';

type Json = Record<string, any>;

export interface K8sInput {
  /** `k8s/kustomization.yaml`, parsed. */
  kustomization: Json;
  /** Every object of the files its `resources:` list names. */
  docs: Json[];
  /** `compose.yaml`, parsed: the names, tags, limits and sizes the manifests mirror. */
  compose: Json;
  /** `.github/workflows/ci.yml`, parsed: the plugin jobs' database tag. */
  workflow?: Json;
}

const WORKLOADS = ['app', 'guardrails-server', 'postgres'] as const;
type WorkloadName = (typeof WORKLOADS)[number];

/** The whole set of writable mounts of each workload, from the design table (NFR5.15). */
export const WRITABLE_MOUNTS: Record<WorkloadName, string[]> = {
  app: ['/app/node_modules/app/dist/static', '/tmp'],
  'guardrails-server': [],
  postgres: ['/tmp', '/var/lib/postgresql/data', '/var/run/postgresql'],
};

/**
 * Written exceptions: the capabilities a workload may add back after
 * `drop: [ALL]`. Empty until a real run shows a container cannot start
 * without one; then the exception, its reason and the name go here and in
 * the manifest comment, so the list can never widen silently (NFR5.15).
 */
export const CAPABILITY_ADDS: Record<WorkloadName, string[]> = {
  app: [],
  'guardrails-server': [],
  postgres: [],
};

export const RUN_AS: Record<WorkloadName, number> = {
  app: 1000,
  'guardrails-server': 1000,
  postgres: 70,
};

interface ProbeRule {
  timeoutSeconds: number;
  /** periodSeconds times failureThreshold, at least (compose's retries). */
  budgetSeconds?: number;
  path?: string;
}
interface WorkloadProbes {
  kind: 'exec' | 'httpGet';
  /** A word the exec command must contain. */
  command?: string;
  startup: ProbeRule;
  readiness: ProbeRule;
  liveness: ProbeRule;
}

const READINESS_PATH = '/.backstage/health/v1/readiness';
const LIVENESS_PATH = '/.backstage/health/v1/liveness';

/** The probe kinds, routes and timings of the design (NFR2.20). */
export const PROBE_TABLE: Record<WorkloadName, WorkloadProbes> = {
  'guardrails-server': {
    kind: 'exec',
    command: 'healthcheck.js',
    startup: { timeoutSeconds: 3, budgetSeconds: 60 },
    readiness: { timeoutSeconds: 3 },
    liveness: { timeoutSeconds: 3 },
  },
  app: {
    kind: 'httpGet',
    startup: { timeoutSeconds: 5, budgetSeconds: 150, path: READINESS_PATH },
    readiness: { timeoutSeconds: 5, path: READINESS_PATH },
    liveness: { timeoutSeconds: 5, path: LIVENESS_PATH },
  },
  postgres: {
    kind: 'exec',
    command: 'pg_isready',
    startup: { timeoutSeconds: 5, budgetSeconds: 100 },
    readiness: { timeoutSeconds: 5 },
    liveness: { timeoutSeconds: 5 },
  },
};

const ALLOWED_KINDS = new Set([
  'ConfigMap',
  'ServiceAccount',
  'Service',
  'Deployment',
  'StatefulSet',
]);
const INIT_ORDER = ['wait-postgres', 'wait-server'];
const HOST_FLAGS = ['hostNetwork', 'hostPID', 'hostIPC'];
const SETTINGS_NAME = 'guardrails-settings';

type Problems = string[];

const named = (doc: Json) => `${doc.kind} ${doc.metadata?.name ?? '?'}`;

function containersOf(spec: Json): Array<{ init: boolean; c: Json }> {
  return [
    ...(spec.initContainers ?? []).map((c: Json) => ({ init: true, c })),
    ...(spec.containers ?? []).map((c: Json) => ({ init: false, c })),
  ];
}

const composeBytes = (text: string): number | undefined => {
  const match = /^(\d+)([kmg]?)b?$/i.exec(String(text).trim());
  if (!match) return undefined;
  const unit = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[
    match[2].toLowerCase() as '' | 'k' | 'm' | 'g'
  ];
  return Number(match[1]) * unit;
};

const k8sBytes = (text: unknown): number | undefined => {
  const match = /^(\d+)(Ki|Mi|Gi|k|M|G)?$/.exec(String(text).trim());
  if (!match) return undefined;
  const unit = (
    {
      '': 1,
      Ki: 1024,
      Mi: 1024 ** 2,
      Gi: 1024 ** 3,
      k: 1e3,
      M: 1e6,
      G: 1e9,
    } as Record<string, number>
  )[match[2] ?? ''];
  return Number(match[1]) * unit;
};

function environmentOf(service: Json | undefined): Record<string, string> {
  const env = service?.environment;
  if (Array.isArray(env)) {
    return Object.fromEntries(
      env.map((line: string) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
    );
  }
  return env ?? {};
}

function checkKinds(input: K8sInput, problems: Problems): void {
  for (const doc of input.docs) {
    if (doc.kind === 'Secret') {
      problems.push(
        `NFR5.14: kind Secret ${doc.metadata?.name ?? ''} is not allowed in k8s/; the start script creates the database Secret.`,
      );
    } else if (doc.kind === 'Ingress') {
      problems.push(
        `NFR5.13: ${named(doc)} is an Ingress; the sample has no Ingress, only a loopback port-forward.`,
      );
    } else if (!ALLOWED_KINDS.has(doc.kind)) {
      problems.push(
        `NFR5.16: ${named(doc)} is not allowed; only the namespaced kinds ConfigMap, ServiceAccount, Service, Deployment and StatefulSet are.`,
      );
    }
  }
  if (input.kustomization?.namespace !== NAMESPACE) {
    problems.push(
      `NFR5.16: the kustomization must set namespace ${NAMESPACE}.`,
    );
  }
  if (input.kustomization?.secretGenerator !== undefined) {
    problems.push(
      'NFR5.14: the kustomization must not use secretGenerator; the start script creates the database Secret.',
    );
  }
}

function checkServices(input: K8sInput, problems: Problems): void {
  const services = input.docs.filter(d => d.kind === 'Service');
  for (const wanted of WORKLOADS) {
    if (!services.some(s => s.metadata?.name === wanted)) {
      problems.push(`NFR2.26: service ${wanted} is missing.`);
    }
  }
  for (const service of services) {
    const type = service.spec?.type;
    if (type !== 'ClusterIP') {
      problems.push(
        `NFR5.13: service ${service.metadata?.name} is of type ${type ?? '(none)'}; it must set type: ClusterIP.`,
      );
    }
  }
}

function checkPod(
  name: WorkloadName,
  workload: Json,
  problems: Problems,
): void {
  const spec = workload.spec?.template?.spec ?? {};
  const security = spec.securityContext ?? {};
  const where = `workload ${name}`;

  for (const flag of HOST_FLAGS) {
    if (spec[flag] === true) {
      problems.push(`NFR5.13: ${where} sets ${flag}.`);
    }
  }
  if (spec.automountServiceAccountToken !== false) {
    problems.push(
      `NFR5.15: ${where} must set automountServiceAccountToken: false.`,
    );
  }
  if (security.runAsNonRoot !== true) {
    problems.push(`NFR5.15: ${where} must set runAsNonRoot: true.`);
  }
  if (security.runAsUser !== RUN_AS[name]) {
    problems.push(
      `NFR5.15: ${where} must set runAsUser: ${RUN_AS[name]} (found ${security.runAsUser ?? 'none'}).`,
    );
  }
  if (security.seccompProfile?.type !== 'RuntimeDefault') {
    problems.push(
      `NFR5.15: ${where} must set seccompProfile type RuntimeDefault.`,
    );
  }

  const volumes: Json[] = spec.volumes ?? [];
  const claims: Json[] = workload.spec?.volumeClaimTemplates ?? [];
  const writableVolumes = new Set<string>([
    ...volumes
      .filter(
        v => v.emptyDir !== undefined || v.persistentVolumeClaim || v.hostPath,
      )
      .map(v => v.name),
    ...claims.map(c => c.metadata?.name),
  ]);
  if (writableVolumes.size > 0 && security.fsGroup !== RUN_AS[name]) {
    problems.push(
      `NFR5.15: ${where} mounts a claim or an emptyDir, so it must set fsGroup: ${RUN_AS[name]} (found ${security.fsGroup ?? 'none'}).`,
    );
  }

  const writable = new Set<string>();
  for (const { init, c } of containersOf(spec)) {
    const label = `${where} ${init ? 'init container' : 'container'} ${c.name}`;
    const context = c.securityContext ?? {};
    if (c.ports?.some((p: Json) => p.hostPort !== undefined)) {
      problems.push(`NFR5.13: ${label} sets hostPort.`);
    }
    if (context.privileged === true) {
      problems.push(`NFR5.15: ${label} must not be privileged.`);
    }
    if (context.allowPrivilegeEscalation !== false) {
      problems.push(
        `NFR5.15: ${label} must set allowPrivilegeEscalation: false.`,
      );
    }
    if (context.readOnlyRootFilesystem !== true) {
      problems.push(`NFR5.15: ${label} must set readOnlyRootFilesystem: true.`);
    }
    if (JSON.stringify(context.capabilities?.drop) !== '["ALL"]') {
      problems.push(`NFR5.15: ${label} must set capabilities.drop to [ALL].`);
    }
    const added = [...(context.capabilities?.add ?? [])].sort();
    const allowed = [...CAPABILITY_ADDS[name]].sort();
    if (JSON.stringify(added) !== JSON.stringify(allowed)) {
      problems.push(
        `NFR5.15: ${label} capabilities.add is [${added.join(', ')}], not the written exception [${allowed.join(', ')}].`,
      );
    }
    const mine = (c.volumeMounts ?? [])
      .filter((m: Json) => writableVolumes.has(m.name) && m.readOnly !== true)
      .map((m: Json) => m.mountPath as string);
    if (init && mine.length > 0) {
      problems.push(
        `NFR5.15: ${label} must have no writable mounts (found ${mine.join(', ')}).`,
      );
    }
    mine.forEach((path: string) => writable.add(path));
  }
  const found = [...writable].sort();
  const wanted = [...WRITABLE_MOUNTS[name]].sort();
  if (JSON.stringify(found) !== JSON.stringify(wanted)) {
    problems.push(
      `NFR5.15: ${where} writable mounts are [${found.join(', ')}], not the written list [${wanted.join(', ')}].`,
    );
  }
}

function checkSecretsOf(
  name: WorkloadName,
  workload: Json,
  problems: Problems,
): void {
  const spec = workload.spec?.template?.spec ?? {};
  for (const { c } of containersOf(spec)) {
    for (const entry of c.env ?? []) {
      if (
        /PASSWORD|TOKEN|SECRET/i.test(entry.name) &&
        entry.value !== undefined
      ) {
        problems.push(
          `NFR5.14: workload ${name} container ${c.name} sets ${entry.name} as a literal value; use secretKeyRef.`,
        );
      }
    }
  }
  if (name === 'guardrails-server') return;
  const main = mainOf(name, spec);
  const password = (main?.env ?? []).find(
    (e: Json) => e.name === 'POSTGRES_PASSWORD',
  );
  const ref = password?.valueFrom?.secretKeyRef;
  if (ref?.name !== SECRET_NAME || ref?.key !== 'POSTGRES_PASSWORD') {
    problems.push(
      `NFR5.14: workload ${name} must set POSTGRES_PASSWORD from the Secret ${SECRET_NAME} with secretKeyRef.`,
    );
  }
}

function mainOf(name: string, spec: Json): Json | undefined {
  return (
    (spec.containers ?? []).find((c: Json) => c.name === name) ??
    spec.containers?.[0]
  );
}

function checkScope(
  input: K8sInput,
  workloads: Array<[WorkloadName, Json]>,
  problems: Problems,
): void {
  const accounts = input.docs
    .filter(d => d.kind === 'ServiceAccount')
    .map(d => d.metadata?.name as string);
  const uses = new Map<string, number>();
  for (const [name, workload] of workloads) {
    const account = workload.spec?.template?.spec?.serviceAccountName;
    if (!account) {
      problems.push(
        `NFR5.16: workload ${name} must name its own service account.`,
      );
      continue;
    }
    uses.set(account, (uses.get(account) ?? 0) + 1);
    if (!accounts.includes(account)) {
      problems.push(
        `NFR5.16: workload ${name} uses service account ${account}, which k8s/ does not define.`,
      );
    }
  }
  for (const account of accounts) {
    const count = uses.get(account) ?? 0;
    if (count > 1) {
      problems.push(
        `NFR5.16: service account ${account} is used by more than one workload.`,
      );
    } else if (count === 0) {
      problems.push(
        `NFR5.16: service account ${account} is used by no workload.`,
      );
    }
  }
}

function tagOf(image: string): string | undefined {
  const last = image.split('/').pop() ?? image;
  return last.includes(':') ? last.split(':').pop() : undefined;
}

function checkVersions(
  input: K8sInput,
  workloads: Array<[WorkloadName, Json]>,
  problems: Problems,
): void {
  const database = input.compose?.services?.postgres?.image as
    string | undefined;
  for (const [name, workload] of workloads) {
    const spec = workload.spec?.template?.spec ?? {};
    for (const { c } of containersOf(spec)) {
      const image: string = c.image ?? '';
      const tag = tagOf(image);
      const label = `workload ${name} container ${c.name}`;
      if (tag === undefined || tag === 'latest') {
        problems.push(
          `NFR5.18: ${label} uses ${image}, which is untagged or latest.`,
        );
      }
      const wantsApp =
        (name === 'app' && c.name === 'app') || c.name === 'wait-server';
      const wantsServer = name === 'guardrails-server';
      const wantsDatabase = name === 'postgres' || c.name === 'wait-postgres';
      if (wantsApp || wantsServer) {
        const want = wantsServer ? SERVER_IMAGE : APP_IMAGE;
        if (image !== want) {
          problems.push(`NFR5.18: ${label} must run ${want}, found ${image}.`);
        }
        if (c.imagePullPolicy !== 'Never') {
          problems.push(
            `NFR5.18: ${label} uses ${image} and must set imagePullPolicy: Never.`,
          );
        }
      } else if (wantsDatabase && database && image !== database) {
        problems.push(
          `NFR5.18: ${label} uses ${image}, not the compose tag ${database}.`,
        );
      }
    }
  }
  for (const [job, definition] of Object.entries<Json>(
    input.workflow?.jobs ?? {},
  )) {
    const image = definition.services?.postgres?.image;
    if (image && database && image !== database) {
      problems.push(
        `NFR5.18: job ${job} uses ${image}, not the compose tag ${database}.`,
      );
    }
  }
}

function checkSettings(
  input: K8sInput,
  workloads: Array<[WorkloadName, Json]>,
  problems: Problems,
): void {
  const map = input.docs.find(
    d => d.kind === 'ConfigMap' && d.metadata?.name === SETTINGS_NAME,
  );
  if (!map) {
    problems.push(`NFR2.27: ConfigMap ${SETTINGS_NAME} is missing.`);
    return;
  }
  const data: Record<string, string> = map.data ?? {};
  const composeEnv = environmentOf(input.compose?.services?.app);
  const wanted = Object.keys(composeEnv).filter(k => k !== 'POSTGRES_PASSWORD');
  for (const key of wanted.filter(k => !(k in data))) {
    problems.push(
      `NFR2.27: ConfigMap ${SETTINGS_NAME} is missing the setting ${key} that the compose file sets.`,
    );
  }
  for (const key of Object.keys(data).filter(k => !wanted.includes(k))) {
    problems.push(
      `NFR2.27: ConfigMap ${SETTINGS_NAME} sets a name that is not in the compose file: ${key}.`,
    );
  }
  if (data.APP_BASE_URL !== data.BACKEND_BASE_URL) {
    problems.push('NFR2.27: APP_BASE_URL and BACKEND_BASE_URL must be equal.');
  }
  if (data.GUARDRAILS_SERVER_URL !== composeEnv.GUARDRAILS_SERVER_URL) {
    problems.push(
      `NFR2.27: GUARDRAILS_SERVER_URL must be ${composeEnv.GUARDRAILS_SERVER_URL} as in the compose file.`,
    );
  }
  if (String(data.GUARDRAILS_DEMO_SIGN_IN) !== 'true') {
    problems.push(
      'NFR5.19: GUARDRAILS_DEMO_SIGN_IN must be "true" in the ConfigMap (demo sign-in is on in this sample only).',
    );
  }
  if ('GUARDRAILS_SEED' in data) {
    problems.push(
      'NFR7.3: GUARDRAILS_SEED must be set on the server only, not in the ConfigMap.',
    );
  }
  for (const [name, workload] of workloads) {
    const spec = workload.spec?.template?.spec ?? {};
    for (const { c } of containersOf(spec)) {
      if (
        (c.env ?? []).some((e: Json) => e.name === 'GUARDRAILS_DEMO_SIGN_IN')
      ) {
        problems.push(
          `NFR5.19: GUARDRAILS_DEMO_SIGN_IN may be set only in the ConfigMap, not in workload ${name}.`,
        );
      }
    }
  }
  const serverSpec = workloads.find(([n]) => n === 'guardrails-server')?.[1]
    .spec?.template?.spec;
  const seed = (mainOf('guardrails-server', serverSpec ?? {})?.env ?? []).find(
    (e: Json) => e.name === 'GUARDRAILS_SEED',
  );
  if (String(seed?.value) !== SEED) {
    problems.push(
      `NFR7.3: the guardrails-server must set GUARDRAILS_SEED to the literal ${SEED}.`,
    );
  }
}

function checkProbes(
  name: WorkloadName,
  workload: Json,
  problems: Problems,
): void {
  const spec = workload.spec?.template?.spec ?? {};
  const main = mainOf(name, spec) ?? {};
  const table = PROBE_TABLE[name];
  const where = `workload ${name}`;
  for (const type of ['startup', 'readiness', 'liveness'] as const) {
    const probeName = `${type}Probe`;
    const probe = main[probeName];
    if (!probe) {
      problems.push(
        `NFR2.20: ${where} container ${main.name} has no ${probeName}.`,
      );
      continue;
    }
    const rule = table[type];
    if (probe[table.kind] === undefined) {
      problems.push(
        `NFR2.20: ${where} ${probeName} must be an ${table.kind} probe.`,
      );
    } else if (table.kind === 'httpGet') {
      if (rule.path !== undefined && probe.httpGet.path !== rule.path) {
        problems.push(
          `NFR2.20: ${where} ${probeName} must use the route ${rule.path}.`,
        );
      }
    } else if (
      table.command &&
      !(probe.exec?.command ?? []).join(' ').includes(table.command)
    ) {
      problems.push(
        `NFR2.20: ${where} ${probeName} must run ${table.command}.`,
      );
    }
    if (
      typeof probe.timeoutSeconds !== 'number' ||
      probe.timeoutSeconds < rule.timeoutSeconds
    ) {
      problems.push(
        `NFR2.20: ${where} ${probeName} needs timeoutSeconds of at least ${rule.timeoutSeconds} (found ${probe.timeoutSeconds ?? 'none'}).`,
      );
    }
    if (rule.budgetSeconds !== undefined) {
      const budget =
        (probe.periodSeconds ?? 10) * (probe.failureThreshold ?? 3);
      if (budget < rule.budgetSeconds) {
        problems.push(
          `NFR2.20: ${where} startup budget is ${budget} s; it must be at least ${rule.budgetSeconds} s (compose's).`,
        );
      }
    }
  }
  if (name === 'app') {
    const order = (spec.initContainers ?? []).map((c: Json) => c.name);
    if (JSON.stringify(order) !== JSON.stringify(INIT_ORDER)) {
      problems.push(
        `NFR2.7: workload app must have the init containers ${INIT_ORDER.join(', ')} in that order (found ${order.join(', ') || 'none'}).`,
      );
    }
  }
  if (
    workload.kind === 'Deployment' &&
    workload.spec?.progressDeadlineSeconds !== 300
  ) {
    problems.push(`NFR2.20: ${where} must set progressDeadlineSeconds: 300.`);
  }
  if (
    name === 'guardrails-server' &&
    spec.terminationGracePeriodSeconds !== 5
  ) {
    problems.push(
      `NFR2.20: ${where} must set terminationGracePeriodSeconds: 5.`,
    );
  }
}

function checkSizing(
  input: K8sInput,
  name: WorkloadName,
  workload: Json,
  problems: Problems,
): void {
  const spec = workload.spec?.template?.spec ?? {};
  const main = mainOf(name, spec) ?? {};
  const where = `workload ${name}`;
  const resources = main.resources ?? {};
  for (const path of ['requests.memory', 'requests.cpu', 'limits.memory']) {
    const [group, key] = path.split('.');
    if (resources[group]?.[key] === undefined) {
      problems.push(`NFR2.20: ${where} container ${main.name} has no ${path}.`);
    }
  }
  const service = input.compose?.services?.[name] ?? {};
  const limit = k8sBytes(resources.limits?.memory);
  const composeLimit = composeBytes(service.mem_limit ?? '');
  if (
    limit !== undefined &&
    composeLimit !== undefined &&
    limit > composeLimit
  ) {
    problems.push(
      `NFR2.20: ${where} limit ${resources.limits.memory} is larger than compose's mem_limit ${service.mem_limit}.`,
    );
  }
  const request = k8sBytes(resources.requests?.memory);
  if (request !== undefined && limit !== undefined && request > limit) {
    problems.push(
      `NFR2.20: ${where} request ${resources.requests.memory} is larger than its limit ${resources.limits.memory}.`,
    );
  }
  // The emptyDir size limits equal compose's tmpfs sizes.
  const volumes: Json[] = spec.volumes ?? [];
  for (const entry of (service.tmpfs ?? []) as string[]) {
    const [path, options = ''] = entry.split(':');
    const size = /size=(\w+)/.exec(options)?.[1];
    if (size === undefined) continue;
    const mount = containersOf(spec)
      .flatMap(({ c }) => c.volumeMounts ?? [])
      .find((m: Json) => m.mountPath === path);
    const volume = volumes.find(v => v.name === mount?.name);
    const found = volume?.emptyDir?.sizeLimit;
    if (found === undefined || k8sBytes(found) !== composeBytes(size)) {
      problems.push(
        `NFR2.20: ${where} volume for ${path} needs an emptyDir sizeLimit equal to compose's ${size} (found ${found ?? 'none'}).`,
      );
    }
  }
}

/**
 * Checks the parsed manifests of `k8s/` against NFR2.7, NFR2.20, NFR2.27,
 * NFR5.13 to NFR5.19 and NFR7.3, without a cluster. Messages name the place,
 * never a value.
 */
export function checkK8s(input: K8sInput): string[] {
  const problems: Problems = [];
  checkKinds(input, problems);
  checkServices(input, problems);

  const workloads: Array<[WorkloadName, Json]> = [];
  for (const name of WORKLOADS) {
    const kind = name === 'postgres' ? 'StatefulSet' : 'Deployment';
    const workload = input.docs.find(
      d => d.kind === kind && d.metadata?.name === name,
    );
    if (!workload) {
      problems.push(`NFR2.26: ${kind} ${name} is missing.`);
      continue;
    }
    workloads.push([name, workload]);
  }
  for (const [name, workload] of workloads) {
    checkPod(name, workload, problems);
    checkSecretsOf(name, workload, problems);
    checkProbes(name, workload, problems);
    checkSizing(input, name, workload, problems);
  }
  checkScope(input, workloads, problems);
  checkVersions(input, workloads, problems);
  checkSettings(input, workloads, problems);

  for (const doc of input.docs) {
    for (const found of findLiteralSecrets(doc)) {
      problems.push(
        `${found.replace(/^NFR5\.2:/, 'NFR5.14:')} (${named(doc)})`,
      );
    }
  }
  return problems;
}
