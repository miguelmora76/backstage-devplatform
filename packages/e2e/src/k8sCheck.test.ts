import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { checkK8s, K8sInput, PROBE_TABLE, WRITABLE_MOUNTS } from './k8sCheck';
import { repoRoot } from './repoRoot';
import { loadK8s } from './testing/k8sLoader';

const root = repoRoot();
const readYaml = (...parts: string[]) =>
  parse(readFileSync(join(root, ...parts), 'utf8'));

/** The committed manifests, the compose file and the workflow: the good baseline. */
const baseline = (): K8sInput => ({
  ...loadK8s(root),
  compose: readYaml('compose.yaml'),
  workflow: readYaml('.github', 'workflows', 'ci.yml'),
});

/** Breaks one thing in a copy of the baseline and returns what the rules find. */
function mutate(change: (input: K8sInput) => void): string {
  const input = structuredClone(baseline());
  change(input);
  return checkK8s(input).join('\n');
}

const find = (input: K8sInput, kind: string, name: string) =>
  input.docs.find(d => d.kind === kind && d.metadata?.name === name)!;
const workload = (input: K8sInput, name: string) =>
  find(input, name === 'postgres' ? 'StatefulSet' : 'Deployment', name);
const podSpec = (input: K8sInput, name: string) =>
  workload(input, name).spec.template.spec;
const mainContainer = (input: K8sInput, name: string) =>
  podSpec(input, name).containers[0];
const settings = (input: K8sInput) =>
  find(input, 'ConfigMap', 'guardrails-settings');

describe('the committed k8s/ files (NFR2.20)', () => {
  it('break none of the rules', () => {
    expect(checkK8s(baseline())).toEqual([]);
  });

  it('are all listed in the kustomization, so none is left out of the apply', () => {
    const listed = loadK8s(root).kustomization.resources;
    const onDisk = readdirSync(join(root, 'k8s')).filter(
      f => f.endsWith('.yaml') && f !== 'kustomization.yaml',
    );
    expect([...listed].sort()).toEqual([...onDisk].sort());
  });

  it('stop the loader on a resource that does not exist', () => {
    expect(() => loadK8s(join(root, 'packages', 'e2e'))).toThrow(
      /kustomization\.yaml/,
    );
  });
});

describe('exposure (NFR5.13)', () => {
  it.each(['NodePort', 'LoadBalancer'])('finds a %s service', type => {
    const found = mutate(i => {
      find(i, 'Service', 'app').spec.type = type;
    });
    expect(found).toMatch(new RegExp(`NFR5\\.13.*service app.*${type}`));
  });

  it('finds an Ingress', () => {
    const found = mutate(i => {
      i.docs.push({ kind: 'Ingress', metadata: { name: 'x' }, spec: {} });
    });
    expect(found).toMatch(/NFR5\.13.*Ingress/);
  });

  it('finds a hostPort, hostNetwork and hostPID', () => {
    const found = mutate(i => {
      mainContainer(i, 'app').ports[0].hostPort = 7007;
      podSpec(i, 'guardrails-server').hostNetwork = true;
      podSpec(i, 'postgres').hostPID = true;
    });
    expect(found).toMatch(/NFR5\.13.*app.*hostPort/);
    expect(found).toMatch(/NFR5\.13.*guardrails-server.*hostNetwork/);
    expect(found).toMatch(/NFR5\.13.*postgres.*hostPID/);
  });

  it('wants an explicit ClusterIP for the server and the database', () => {
    const found = mutate(i => {
      delete find(i, 'Service', 'guardrails-server').spec.type;
      delete find(i, 'Service', 'postgres').spec.type;
    });
    expect(found).toMatch(/NFR5\.13.*guardrails-server.*ClusterIP/);
    expect(found).toMatch(/NFR5\.13.*postgres.*ClusterIP/);
  });
});

describe('secrets (NFR5.14)', () => {
  it('finds a literal password in a container', () => {
    const found = mutate(i => {
      const env = mainContainer(i, 'app').env;
      const password = env.find((e: any) => e.name === 'POSTGRES_PASSWORD');
      delete password.valueFrom;
      password.value = 'hunter2hunter2';
    });
    expect(found).toMatch(/NFR5\.14.*app.*POSTGRES_PASSWORD.*literal/);
    expect(found).not.toContain('hunter2hunter2');
  });

  it('finds a password that does not come from the Secret guardrails-db', () => {
    const found = mutate(i => {
      const env = mainContainer(i, 'postgres').env;
      const password = env.find((e: any) => e.name === 'POSTGRES_PASSWORD');
      password.valueFrom = { configMapKeyRef: { name: 'x', key: 'y' } };
    });
    expect(found).toMatch(/NFR5\.14.*postgres.*secretKeyRef/);
  });

  it('finds a container that has no password at all', () => {
    const found = mutate(i => {
      const c = mainContainer(i, 'app');
      c.env = c.env.filter((e: any) => e.name !== 'POSTGRES_PASSWORD');
    });
    expect(found).toMatch(/NFR5\.14.*app.*POSTGRES_PASSWORD/);
  });

  it('finds a Secret object and a secretGenerator', () => {
    const found = mutate(i => {
      i.docs.push({ kind: 'Secret', metadata: { name: 'guardrails-db' } });
      i.kustomization.secretGenerator = [{ name: 'x' }];
    });
    expect(found).toMatch(/NFR5\.14.*kind Secret/);
    expect(found).toMatch(/NFR5\.14.*secretGenerator/);
  });

  it('finds a secret-like literal anywhere else, such as the ConfigMap', () => {
    const found = mutate(i => {
      settings(i).data.API_TOKEN = 'abcdef123456';
    });
    expect(found).toMatch(/NFR5\.14.*literal value for a secret-like name/);
  });
});

describe('rights (NFR5.15)', () => {
  it('finds a container without a read-only root file system', () => {
    const found = mutate(i => {
      mainContainer(
        i,
        'guardrails-server',
      ).securityContext.readOnlyRootFilesystem = false;
    });
    expect(found).toMatch(
      /NFR5\.15.*guardrails-server.*readOnlyRootFilesystem/,
    );
  });

  it('finds privilege escalation and a privileged init container', () => {
    const found = mutate(i => {
      mainContainer(i, 'app').securityContext.allowPrivilegeEscalation = true;
      podSpec(i, 'app').initContainers[0].securityContext.privileged = true;
    });
    expect(found).toMatch(/NFR5\.15.*app.*allowPrivilegeEscalation/);
    expect(found).toMatch(/NFR5\.15.*wait-postgres.*privileged/);
  });

  it('finds capabilities that are not exactly dropped (or added without a written exception)', () => {
    const found = mutate(i => {
      mainContainer(i, 'app').securityContext.capabilities = {
        drop: ['NET_RAW'],
      };
      mainContainer(i, 'postgres').securityContext.capabilities = {
        drop: ['ALL'],
        add: ['CHOWN'],
      };
    });
    expect(found).toMatch(/NFR5\.15.*app.*drop.*ALL/);
    expect(found).toMatch(/NFR5\.15.*postgres.*capabilities\.add/);
  });

  it('finds a pod that mounts the account token or may run as root', () => {
    const found = mutate(i => {
      podSpec(i, 'app').automountServiceAccountToken = true;
      podSpec(i, 'postgres').securityContext.runAsNonRoot = false;
      podSpec(i, 'guardrails-server').securityContext.runAsUser = 0;
      delete podSpec(i, 'app').securityContext.seccompProfile;
    });
    expect(found).toMatch(/NFR5\.15.*app.*automountServiceAccountToken/);
    expect(found).toMatch(/NFR5\.15.*postgres.*runAsNonRoot/);
    expect(found).toMatch(/NFR5\.15.*guardrails-server.*runAsUser/);
    expect(found).toMatch(/NFR5\.15.*app.*seccompProfile/);
  });

  it('wants fsGroup on a pod with a claim or an emptyDir', () => {
    const found = mutate(i => {
      delete podSpec(i, 'app').securityContext.fsGroup;
      delete podSpec(i, 'postgres').securityContext.fsGroup;
    });
    expect(found).toMatch(/NFR5\.15.*app.*fsGroup/);
    expect(found).toMatch(/NFR5\.15.*postgres.*fsGroup/);
  });

  it('finds a writable mount that is not on the written list', () => {
    const found = mutate(i => {
      const spec = podSpec(i, 'guardrails-server');
      spec.volumes = [{ name: 'scratch', emptyDir: { sizeLimit: '1Mi' } }];
      spec.containers[0].volumeMounts = [
        { name: 'scratch', mountPath: '/scratch' },
      ];
    });
    expect(found).toMatch(
      /NFR5\.15.*guardrails-server.*writable mounts.*\/scratch/,
    );
  });

  it('finds a missing writable mount and a read-only flag that hides one', () => {
    const found = mutate(i => {
      const mounts = mainContainer(i, 'app').volumeMounts;
      mounts.find((m: any) => m.mountPath === '/tmp').readOnly = true;
    });
    expect(found).toMatch(/NFR5\.15.*app.*writable mounts/);
  });

  it('finds a writable mount in an init container', () => {
    const found = mutate(i => {
      podSpec(i, 'app').initContainers[1].volumeMounts = [
        { name: 'tmp', mountPath: '/tmp' },
      ];
    });
    expect(found).toMatch(/NFR5\.15.*wait-server.*writable mounts/);
  });

  it('keeps the written list equal to the design table', () => {
    expect(WRITABLE_MOUNTS).toEqual({
      app: ['/app/node_modules/app/dist/static', '/tmp'],
      'guardrails-server': [],
      postgres: ['/tmp', '/var/lib/postgresql/data', '/var/run/postgresql'],
    });
  });
});

describe('scope (NFR5.16)', () => {
  it('finds cluster-scoped kinds and role bindings', () => {
    const found = mutate(i => {
      i.docs.push({ kind: 'ClusterRole', metadata: { name: 'x' } });
      i.docs.push({ kind: 'RoleBinding', metadata: { name: 'y' } });
      i.docs.push({ kind: 'Namespace', metadata: { name: 'z' } });
    });
    expect(found).toMatch(/NFR5\.16.*ClusterRole/);
    expect(found).toMatch(/NFR5\.16.*RoleBinding/);
    expect(found).toMatch(/NFR5\.16.*Namespace/);
  });

  it('wants the kustomization to set the namespace', () => {
    expect(mutate(i => delete i.kustomization.namespace)).toMatch(
      /NFR5\.16.*namespace guardrails-sample/,
    );
    expect(mutate(i => (i.kustomization.namespace = 'default'))).toMatch(
      /NFR5\.16.*namespace guardrails-sample/,
    );
  });

  it('wants one service account per workload, each used by its own workload only', () => {
    const shared = mutate(i => {
      podSpec(i, 'postgres').serviceAccountName = 'app';
    });
    expect(shared).toMatch(/NFR5\.16.*service account app.*more than one/);
    const missing = mutate(i => {
      podSpec(i, 'app').serviceAccountName = 'ghost';
    });
    expect(missing).toMatch(/NFR5\.16.*app.*ghost/);
    const extra = mutate(i => {
      i.docs.push({ kind: 'ServiceAccount', metadata: { name: 'spare' } });
    });
    expect(extra).toMatch(/NFR5\.16.*spare/);
  });
});

describe('versions (NFR5.18)', () => {
  it('finds a database tag that differs from compose and from the plugin jobs', () => {
    const fromCompose = mutate(i => {
      mainContainer(i, 'postgres').image = 'postgres:16.14-alpine3.24';
    });
    expect(fromCompose).toMatch(/NFR5\.18.*postgres.*compose/);
    const fromJobs = mutate(i => {
      i.workflow!.jobs['plugin-rules'].services.postgres.image =
        'postgres:16.14-alpine3.24';
    });
    expect(fromJobs).toMatch(/NFR5\.18.*plugin-rules/);
  });

  it('finds latest and an untagged image', () => {
    const found = mutate(i => {
      mainContainer(i, 'guardrails-server').image = 'guardrails-server:latest';
      podSpec(i, 'app').initContainers[0].image = 'busybox';
    });
    expect(found).toMatch(/NFR5\.18.*guardrails-server:latest/);
    expect(found).toMatch(/NFR5\.18.*busybox/);
  });

  it('wants the two built images to be :local and never pulled', () => {
    const found = mutate(i => {
      mainContainer(i, 'app').imagePullPolicy = 'IfNotPresent';
      mainContainer(i, 'guardrails-server').image = 'registry.example/x:1.0';
    });
    expect(found).toMatch(/NFR5\.18.*app.*imagePullPolicy: Never/);
    expect(found).toMatch(
      /NFR5\.18.*guardrails-server.*guardrails-server:local/,
    );
  });
});

describe('settings (NFR5.19, NFR7.3, NFR2.27)', () => {
  it('wants the same setting names as the compose file', () => {
    const found = mutate(i => {
      delete settings(i).data.BACKEND_PORT;
      settings(i).data.EXTRA_SETTING = 'x';
    });
    expect(found).toMatch(/NFR2\.27.*missing.*BACKEND_PORT/);
    expect(found).toMatch(/NFR2\.27.*not in the compose file.*EXTRA_SETTING/);
  });

  it('wants equal base addresses and the compose server address', () => {
    const found = mutate(i => {
      settings(i).data.APP_BASE_URL = 'http://localhost:3000';
      settings(i).data.GUARDRAILS_SERVER_URL = 'http://elsewhere:7007';
    });
    expect(found).toMatch(/NFR2\.27.*APP_BASE_URL.*BACKEND_BASE_URL/);
    expect(found).toMatch(/NFR2\.27.*GUARDRAILS_SERVER_URL/);
  });

  it('wants the seed as a literal on the server, and only there', () => {
    const wrong = mutate(i => {
      const env = mainContainer(i, 'guardrails-server').env;
      env.find((e: any) => e.name === 'GUARDRAILS_SEED').value = '5';
    });
    expect(wrong).toMatch(/NFR7\.3.*GUARDRAILS_SEED.*20261106/);
    const moved = mutate(i => {
      settings(i).data.GUARDRAILS_SEED = '20261106';
    });
    expect(moved).toMatch(/NFR7\.3.*GUARDRAILS_SEED.*ConfigMap/);
  });

  it('wants the demo sign-in on in the ConfigMap and nowhere else', () => {
    const off = mutate(i => {
      settings(i).data.GUARDRAILS_DEMO_SIGN_IN = 'false';
    });
    expect(off).toMatch(/NFR5\.19.*GUARDRAILS_DEMO_SIGN_IN.*true/);
    const elsewhere = mutate(i => {
      mainContainer(i, 'app').env.push({
        name: 'GUARDRAILS_DEMO_SIGN_IN',
        value: 'true',
      });
    });
    expect(elsewhere).toMatch(/NFR5\.19.*only in the ConfigMap/);
  });
});

describe('probes and start order (NFR2.20, NFR2.7)', () => {
  it('wants startup, readiness and liveness probes on every workload', () => {
    const found = mutate(i => {
      delete mainContainer(i, 'app').startupProbe;
      delete mainContainer(i, 'postgres').livenessProbe;
      delete mainContainer(i, 'guardrails-server').readinessProbe;
    });
    expect(found).toMatch(/NFR2\.20.*app.*startupProbe/);
    expect(found).toMatch(/NFR2\.20.*postgres.*livenessProbe/);
    expect(found).toMatch(/NFR2\.20.*guardrails-server.*readinessProbe/);
  });

  it('wants an explicit timeout at least as long as the table says', () => {
    const found = mutate(i => {
      delete mainContainer(i, 'guardrails-server').startupProbe.timeoutSeconds;
      mainContainer(i, 'app').readinessProbe.timeoutSeconds = 1;
    });
    expect(found).toMatch(
      /NFR2\.20.*guardrails-server.*startupProbe.*timeoutSeconds/,
    );
    expect(found).toMatch(/NFR2\.20.*app.*readinessProbe.*timeoutSeconds/);
  });

  it("wants each startup budget to be at least compose's", () => {
    const found = mutate(i => {
      mainContainer(i, 'postgres').startupProbe.failureThreshold = 5;
    });
    expect(found).toMatch(/NFR2\.20.*postgres.*startup budget.*100/);
  });

  it('wants the probe kinds and routes of the table', () => {
    const found = mutate(i => {
      const app = mainContainer(i, 'app');
      app.livenessProbe.httpGet.path = '/.backstage/health/v1/readiness';
      delete mainContainer(i, 'guardrails-server').readinessProbe.exec;
      mainContainer(i, 'guardrails-server').readinessProbe.tcpSocket = {
        port: 7007,
      };
    });
    expect(found).toMatch(
      /NFR2\.20.*app.*livenessProbe.*\/\.backstage\/health\/v1\/liveness/,
    );
    expect(found).toMatch(/NFR2\.20.*guardrails-server.*readinessProbe.*exec/);
  });

  it('wants both init containers of the app, in order', () => {
    const missing = mutate(i => {
      podSpec(i, 'app').initContainers.pop();
    });
    expect(missing).toMatch(/NFR2\.7.*app.*wait-postgres, wait-server/);
    const swapped = mutate(i => {
      podSpec(i, 'app').initContainers.reverse();
    });
    expect(swapped).toMatch(/NFR2\.7.*app.*wait-postgres, wait-server/);
  });

  it('wants progressDeadlineSeconds on each Deployment and a short stop for the server', () => {
    const found = mutate(i => {
      delete workload(i, 'app').spec.progressDeadlineSeconds;
      podSpec(i, 'guardrails-server').terminationGracePeriodSeconds = 30;
    });
    expect(found).toMatch(/NFR2\.20.*app.*progressDeadlineSeconds/);
    expect(found).toMatch(
      /NFR2\.20.*guardrails-server.*terminationGracePeriodSeconds: 5/,
    );
  });

  it('keeps the probe table equal to the design', () => {
    expect(PROBE_TABLE.app.liveness.path).toBe(
      '/.backstage/health/v1/liveness',
    );
    expect(PROBE_TABLE.app.startup.budgetSeconds).toBe(150);
    expect(PROBE_TABLE['guardrails-server'].startup.budgetSeconds).toBe(60);
    expect(PROBE_TABLE.postgres.startup.budgetSeconds).toBe(100);
  });
});

describe('sizing (NFR2.20)', () => {
  it("finds a limit above compose's mem_limit and a request above its limit", () => {
    const found = mutate(i => {
      mainContainer(i, 'app').resources.limits.memory = '2Gi';
      mainContainer(i, 'guardrails-server').resources.requests.memory = '512Mi';
    });
    expect(found).toMatch(/NFR2\.20.*app.*limit.*compose/);
    expect(found).toMatch(/NFR2\.20.*guardrails-server.*request.*limit/);
  });

  it('finds missing requests and limits', () => {
    const found = mutate(i => {
      delete mainContainer(i, 'postgres').resources.limits;
      delete mainContainer(i, 'app').resources.requests.cpu;
    });
    expect(found).toMatch(/NFR2\.20.*postgres.*limits\.memory/);
    expect(found).toMatch(/NFR2\.20.*app.*requests\.cpu/);
  });

  it('finds an emptyDir without the size limit of the compose tmpfs', () => {
    const found = mutate(i => {
      const volumes = podSpec(i, 'app').volumes;
      delete volumes.find((v: any) => v.name === 'tmp').emptyDir.sizeLimit;
      podSpec(i, 'postgres').volumes.find(
        (v: any) => v.name === 'run',
      ).emptyDir.sizeLimit = '64Mi';
    });
    expect(found).toMatch(/NFR2\.20.*app.*\/tmp.*sizeLimit/);
    expect(found).toMatch(
      /NFR2\.20.*postgres.*\/var\/run\/postgresql.*sizeLimit/,
    );
  });
});
