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
