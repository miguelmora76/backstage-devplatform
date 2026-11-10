import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { checkWorkflow, SECRET_EXEMPTIONS } from './workflowCheck';
import { repoRoot } from './repoRoot';
import { findLiteralSecrets } from './secretCheck';

const root = repoRoot();
const workflowText = () =>
  readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const workflow = () => parse(workflowText());
const compose = () => parse(readFileSync(join(root, 'compose.yaml'), 'utf8'));
const bad = () =>
  parse(
    readFileSync(
      join(
        root,
        'packages',
        'e2e',
        'src',
        'testing',
        'fixtures',
        'workflow-bad.yaml',
      ),
      'utf8',
    ),
  );

describe('.github/workflows/ci.yml (real file)', () => {
  it('breaks none of the rules', () => {
    expect(checkWorkflow(workflow(), workflowText(), compose())).toEqual([]);
  });

  it('can only read the code (NFR5.9)', () => {
    const doc = workflow();
    expect(doc.permissions).toEqual({ contents: 'read' });
    for (const job of Object.values<any>(doc.jobs)) {
      expect(job.permissions).toBeUndefined();
    }
    expect(Object.keys(doc.on)).toEqual(['pull_request', 'push']);
    expect(doc.on.push.branches).toEqual(['main']);
  });

  it('puts a time limit on every job, 25 minutes for the compose job', () => {
    const jobs = workflow().jobs;
    for (const [name, job] of Object.entries<any>(jobs)) {
      expect([name, typeof job['timeout-minutes']]).toEqual([name, 'number']);
    }
    expect(jobs['compose-e2e']['timeout-minutes']).toBe(25);
    expect(jobs['e2e-unit']['timeout-minutes']).toBe(15);
  });

  it('has ci-ok needing every other job and running even after a failure', () => {
    const jobs = workflow().jobs;
    const others = Object.keys(jobs).filter(name => name !== 'ci-ok');
    expect([...jobs['ci-ok'].needs].sort()).toEqual([...others].sort());
    expect(jobs['ci-ok'].if).toBe('always()');
  });

  it('adds the four new jobs and the package lint and typecheck steps', () => {
    const doc = workflow();
    for (const name of ['e2e-unit', 'app-image', 'compose-e2e', 'ci-ok']) {
      expect(doc.jobs).toHaveProperty(name);
    }
    const lint = JSON.stringify(doc.jobs.lint.steps);
    const typecheck = JSON.stringify(doc.jobs.typecheck.steps);
    expect(lint).toContain('env.E2E');
    expect(typecheck).toContain('env.E2E');
  });

  it('installs only Playwright Firefox before starting either live stack', () => {
    const jobs = workflow().jobs;
    for (const [jobName, start] of [
      ['compose-e2e', 'yarn compose:reset'],
      ['minikube-e2e', 'minikube start'],
    ]) {
      const steps = jobs[jobName].steps as any[];
      const installIndex = steps.findIndex(step =>
        /playwright install firefox/.test(String(step.run)),
      );
      const startIndex = steps.findIndex(step =>
        String(step.run).includes(start),
      );
      const runs = steps.map(step => String(step.run ?? '')).join('\n');
      expect(installIndex).toBeGreaterThan(-1);
      expect(installIndex).toBeLessThan(startIndex);
      expect(runs).not.toContain('playwright install --with-deps');
      expect(runs).not.toMatch(/playwright install .*chrome/);
    }
  });

  it('uses the same exact database tag as compose in both plugin jobs', () => {
    const tag = compose().services.postgres.image;
    const jobs = workflow().jobs;
    expect(jobs['plugin-rules'].services.postgres.image).toBe(tag);
    expect(jobs['plugin-coverage'].services.postgres.image).toBe(tag);
  });

  it('names the throw-away login as the only secret exemption (NFR5.2)', () => {
    expect(SECRET_EXEMPTIONS).toHaveLength(2);
    expect(findLiteralSecrets(workflow(), SECRET_EXEMPTIONS)).toEqual([]);
    expect(findLiteralSecrets(workflow())).toHaveLength(
      Object.values<any>(workflow().jobs).filter(j => j.services?.postgres)
        .length * 2,
    );
    expect(workflowText()).toMatch(/throw-away/);
  });

  it('never logs in, pushes or deploys, and uses no repository secret', () => {
    const text = workflowText();
    expect(text).not.toMatch(/docker (login|push)/);
    expect(text).not.toMatch(/secrets\./);
    expect(text).not.toMatch(/pull_request_target/);
  });

  it('shows the exemption comment next to the database login', () => {
    expect(workflowText()).toMatch(/exemption/i);
  });
});

describe('the minikube-e2e job (u6-minikube-run, NFR2.21, NFR5.18, NFR5.21)', () => {
  const job = () => workflow().jobs['minikube-e2e'];
  const runs = () =>
    (job().steps as any[]).map(step => String(step.run ?? '')).join('\n');

  it('exists, needs app-image, has a 35-minute limit and is required by ci-ok', () => {
    const doc = workflow();
    expect(job()).toBeDefined();
    expect([job().needs].flat()).toEqual(['app-image']);
    expect(job()['runs-on']).toBe('ubuntu-latest');
    expect(job()['timeout-minutes']).toBe(35);
    expect(job().permissions).toBeUndefined();
    expect(doc.jobs['ci-ok'].needs).toContain('minikube-e2e');
    expect(doc.jobs['ci-ok'].if).toBe('always()');
  });

  it('downloads minikube and kubectl at exact versions, each checked with sha256sum -c', () => {
    const downloads = (job().steps as any[]).filter(step =>
      /\bcurl\b|\bwget\b/.test(String(step.run ?? '')),
    );
    expect(downloads).toHaveLength(2);
    const text = downloads.map(step => String(step.run)).join('\n');
    expect(text).toMatch(
      /releases\/download\/v\d+\.\d+\.\d+\/minikube-linux-amd64/,
    );
    expect(text).toMatch(
      /dl\.k8s\.io\/release\/v\d+\.\d+\.\d+\/bin\/linux\/amd64\/kubectl/,
    );
    for (const step of downloads) {
      expect(String(step.run)).toMatch(/[0-9a-f]{64}\s+\S+/);
      expect(String(step.run)).toMatch(/sha256sum -c/);
      expect(String(step.run)).not.toMatch(/latest|stable/);
    }
  });

  it('uses only actions/* and never logs in, pushes or deploys', () => {
    const foreign = (job().steps as any[]).filter(
      step => step.uses && !/^actions\//.test(step.uses),
    );
    expect(foreign).toEqual([]);
    expect(runs()).not.toMatch(/docker (login|push)/);
    expect(runs()).not.toMatch(/helm|argocd|kubectl apply/);
  });

  it('runs the specs on minikube and the timing check without blocking, in this job only', () => {
    const doc = workflow();
    const text = JSON.stringify(job().steps);
    expect(text).toContain('E2E_STACK=minikube');
    expect(text).toContain('E2E_TIMING_BLOCKING=false');
    const composeSteps = JSON.stringify(doc.jobs['compose-e2e'].steps);
    expect(composeSteps).not.toContain('E2E_STACK');
    expect(composeSteps).not.toContain('E2E_TIMING_BLOCKING');
  });

  it('starts fresh twice, compares the plan, checks, and always stops the sample', () => {
    const text = runs();
    expect(text.match(/yarn minikube:up/g)).toHaveLength(2);
    expect(text.match(/yarn minikube:down/g)!.length).toBeGreaterThanOrEqual(3);
    expect(text).toContain('yarn e2e plan-compare');
    expect(text).toContain('yarn e2e minikube-checks');
    expect(text).toContain('yarn e2e minikube-closed');
    const stop = (job().steps as any[]).find(
      step =>
        /yarn minikube:down/.test(String(step.run ?? '')) &&
        step.if === 'always()',
    );
    expect(stop).toBeDefined();
    const upload = (job().steps as any[]).find(step =>
      String(step.uses ?? '').startsWith('actions/upload-artifact'),
    );
    expect(upload.if).toBe('always()');
    expect(upload.with['retention-days']).toBe(7);
  });

  it('prints the diagnosis on failure (NFR2.22)', () => {
    const step = (job().steps as any[]).find(s => s.if === 'failure()');
    expect(String(step.run)).toContain('get pods,svc,pvc');
    expect(String(step.run)).toContain('describe pods');
    expect(String(step.run)).toContain('logs');
    expect(String(step.run)).toContain('--context minikube');
  });
});

describe('checkWorkflow rules for the minikube-e2e job', () => {
  const text = () => workflowText();
  const found = (change: (doc: any) => void) => {
    const doc = workflow();
    change(doc);
    return checkWorkflow(doc, text(), compose()).join('\n');
  };

  it('finds the job missing', () => {
    expect(found(doc => delete doc.jobs['minikube-e2e'])).toMatch(
      /NFR2\.21.*minikube-e2e/,
    );
  });

  it('finds a wrong needs, runner or time limit', () => {
    const message = found(doc => {
      doc.jobs['minikube-e2e'].needs = 'format';
      doc.jobs['minikube-e2e']['runs-on'] = 'self-hosted';
      doc.jobs['minikube-e2e']['timeout-minutes'] = 60;
    });
    expect(message).toMatch(/NFR2\.21.*needs app-image/);
    expect(message).toMatch(/NFR2\.21.*ubuntu-latest/);
    expect(message).toMatch(/NFR2\.21.*timeout-minutes: 35/);
  });

  it('finds a download without a digest check or at a moving version', () => {
    const message = found(doc => {
      const steps = doc.jobs['minikube-e2e'].steps as any[];
      const kubectl = steps.find(s => /dl\.k8s\.io/.test(String(s.run)));
      kubectl.run = kubectl.run.replace(/sha256sum -c/g, 'cat');
      const minikube = steps.find(s =>
        /minikube-linux-amd64/.test(String(s.run)),
      );
      minikube.run = minikube.run.replace(/v\d+\.\d+\.\d+/g, 'latest');
    });
    expect(message).toMatch(/NFR5\.18.*kubectl.*sha256sum -c/);
    expect(message).toMatch(/NFR5\.18.*minikube.*exact version/);
  });

  it('finds the timing switch or the stack switch in the compose job', () => {
    const message = found(doc => {
      doc.jobs['compose-e2e'].steps.push({
        run: 'E2E_TIMING_BLOCKING=false yarn e2e:timing',
      });
    });
    expect(message).toMatch(/NFR1\.5.*compose-e2e/);
  });

  it('finds a minikube job that does not stop the sample or set the switches', () => {
    const message = found(doc => {
      const steps = doc.jobs['minikube-e2e'].steps as any[];
      for (const step of steps) {
        if (step.if === 'always()' && /minikube:down/.test(String(step.run))) {
          delete step.if;
        }
        if (step.run) {
          step.run = String(step.run)
            .replace(/E2E_STACK=minikube/g, '')
            .replace(/E2E_TIMING_BLOCKING=false/g, '');
        }
      }
    });
    expect(message).toMatch(/NFR2\.23.*always/);
    expect(message).toMatch(/NFR2\.24.*E2E_STACK=minikube/);
    expect(message).toMatch(/NFR1\.5.*E2E_TIMING_BLOCKING=false/);
  });
});

describe('checkWorkflow (fixture proves the rules fail)', () => {
  it('finds every deliberate fault', () => {
    const text = readFileSync(
      join(
        root,
        'packages',
        'e2e',
        'src',
        'testing',
        'fixtures',
        'workflow-bad.yaml',
      ),
      'utf8',
    );
    const found = checkWorkflow(bad(), text, compose()).join('\n');
    expect(found).toMatch(/NFR5\.9.*contents: read/);
    expect(found).toMatch(/NFR5\.9.*pull_request_target/);
    expect(found).toMatch(/NFR5\.9.*job build.*permissions/);
    expect(found).toMatch(/NFR5\.9.*job build.*timeout/);
    expect(found).toMatch(/NFR5\.9.*docker (login|push)/);
    expect(found).toMatch(/NFR5\.2.*secrets\./);
    expect(found).toMatch(/NFR5\.2.*POSTGRES_PASSWORD/);
    expect(found).toMatch(/NFR5\.4.*someone\/else-action/);
    expect(found).toMatch(/NFR5\.4.*postgres:16/);
    expect(found).toMatch(/NFR2\.4.*ci-ok.*always/);
    expect(found).toMatch(/NFR2\.4.*pull_request/);
  });

  it('finds a ci-ok that misses a job', () => {
    const doc = workflow();
    doc.jobs['ci-ok'].needs = doc.jobs['ci-ok'].needs.slice(1);
    expect(checkWorkflow(doc, workflowText(), compose())).toEqual([
      expect.stringMatching(/ci-ok.*does not need/),
    ]);
  });

  it('finds a job without a time limit on its own', () => {
    const doc = workflow();
    delete doc.jobs.format['timeout-minutes'];
    expect(checkWorkflow(doc, workflowText(), compose())).toEqual([
      expect.stringMatching(/job format.*timeout/),
    ]);
  });

  it('refuses a document with no jobs', () => {
    expect(checkWorkflow({}, '', compose())).toEqual(
      expect.arrayContaining([expect.stringMatching(/jobs/)]),
    );
  });
});
