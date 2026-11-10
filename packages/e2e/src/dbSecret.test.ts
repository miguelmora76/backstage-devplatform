import { ensureSecret, SECRET_NAME } from './dbSecret';
import { fakeRunner, Rule } from './testing/fakeRunner';

const NOT_FOUND = {
  status: 1,
  stderr: 'Error from server (NotFound): secrets "guardrails-db" not found',
};
const random = () => Buffer.alloc(16, 0xab);
const VALUE = 'ab'.repeat(16);

const noSecret: Rule = { when: ['get', 'secret'], result: NOT_FOUND };
const noClaim: Rule = {
  when: ['get', 'pvc'],
  result: {
    status: 1,
    stderr: 'Error from server (NotFound): persistentvolumeclaims not found',
  },
};
const creates: Rule = { when: ['create'] };

describe('ensureSecret (NFR5.14)', () => {
  it('creates the Secret from a manifest on standard input, with the value in no argument', () => {
    const { run, calls } = fakeRunner([noSecret, noClaim, creates]);
    const result = ensureSecret(run, random);
    expect(result).toEqual({ created: true });
    const create = calls.find(c => c.args.includes('create'))!;
    // `-f -` makes kubectl read the stream itself; `--from-file=…=/dev/stdin`
    // fails ("no such device or address") when the input is a pipe or socket.
    expect(create.args).toEqual([
      '--context',
      'minikube',
      '-n',
      'guardrails-sample',
      'create',
      '-f',
      '-',
    ]);
    const manifest = JSON.parse(create.options?.input ?? '{}');
    expect(manifest).toEqual({
      apiVersion: 'v1',
      kind: 'Secret',
      type: 'Opaque',
      metadata: { name: SECRET_NAME },
      stringData: { POSTGRES_PASSWORD: VALUE },
    });
    expect(manifest.stringData.POSTGRES_PASSWORD).toHaveLength(32);
    for (const call of calls) {
      expect(call.line).not.toContain(VALUE);
    }
  });

  it('uses the secure random source of the process by default', () => {
    const { run, calls } = fakeRunner([noSecret, noClaim, creates]);
    ensureSecret(run);
    ensureSecret(run);
    const passwords = calls
      .filter(c => c.args.includes('create'))
      .map(
        c => JSON.parse(c.options?.input ?? '{}').stringData.POSTGRES_PASSWORD,
      );
    expect(passwords[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(passwords[0]).not.toBe(passwords[1]);
  });

  it('leaves an existing Secret unchanged and writes nothing', () => {
    const { run, lines } = fakeRunner([
      { when: ['get', 'secret'], result: { stdout: 'secret/guardrails-db\n' } },
    ]);
    expect(ensureSecret(run, random)).toEqual({ created: false });
    expect(lines()).toHaveLength(1);
  });

  it('stops when the claim exists but the Secret does not, naming yarn minikube:down', () => {
    const { run, lines } = fakeRunner([
      noSecret,
      { when: ['get', 'pvc'], result: { stdout: 'pvc/postgres-data\n' } },
    ]);
    expect(() => ensureSecret(run, random)).toThrow(/yarn minikube:down/);
    expect(lines().join('\n')).not.toMatch(/create/);
  });

  it('never puts the value in a thrown message, even when kubectl echoes it', () => {
    const { run } = fakeRunner([
      noSecret,
      noClaim,
      {
        when: ['create'],
        result: { status: 1, stderr: `failed to read ${VALUE}` },
      },
    ]);
    let message = '';
    try {
      ensureSecret(run, random);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/could not create/i);
    expect(message).not.toContain(VALUE);
  });

  it('stops on an error that is not "not found" instead of creating a Secret', () => {
    const { run, lines } = fakeRunner([
      {
        when: ['get', 'secret'],
        result: {
          status: 1,
          stderr: 'The connection to the server was refused',
        },
      },
    ]);
    expect(() => ensureSecret(run, random)).toThrow(/connection .* refused/);
    expect(lines().join('\n')).not.toMatch(/create/);
  });
});
