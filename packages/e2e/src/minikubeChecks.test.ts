import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Connect } from './exposureCheck';
import { runClosedCheck, runMinikubeChecks } from './minikubeChecks';
import { repoRoot } from './repoRoot';
import { fakeRunner, Rule } from './testing/fakeRunner';

function tempDir(): string {
  const base = join(repoRoot(), 'packages', 'e2e', 'dist', 'test-tmp');
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, 'chk-'));
}

const PASSWORD = 'f00dfeed'.repeat(4);
const goodPods = JSON.stringify({
  items: [
    {
      metadata: { name: 'app-1' },
      status: { containerStatuses: [{ restartCount: 0 }] },
    },
  ],
});
const config = JSON.stringify([
  { Config: { User: 'node', ExposedPorts: { '7007/tcp': {} } } },
]);

interface Options {
  pods?: string;
  logs?: string;
  user?: string;
  connect?: Connect;
  address?: string | undefined;
  secret?: { status: number; stdout: string };
}

function setup(options: Options = {}) {
  const rules: Rule[] = [
    {
      when: ['ssh', 'inspect'],
      result: () => ({
        stdout: options.user
          ? JSON.stringify([
              {
                Config: {
                  User: options.user,
                  ExposedPorts: { '7007/tcp': {} },
                },
              },
            ])
          : config,
      }),
    },
    { when: ['ssh', 'du'], result: { stdout: '400\n' } },
    {
      when: ['get', 'pods', '-o', 'json'],
      result: { stdout: options.pods ?? goodPods },
    },
    { when: ['get', 'pods', '-o', 'name'], result: { stdout: 'pod/app-1\n' } },
    { when: ['logs'], result: { stdout: options.logs ?? 'started fine\n' } },
    {
      when: ['get', 'secret'],
      result: options.secret ?? {
        status: 0,
        stdout: Buffer.from(PASSWORD).toString('base64'),
      },
    },
  ];
  const { run, lines } = fakeRunner(rules);
  const logs: string[] = [];
  const deps = {
    run,
    root: tempDir(),
    log: (m: string) => logs.push(m),
    connect:
      options.connect ??
      (async (host: string) => (host === '127.0.0.1' ? 'accepted' : 'refused')),
    address: 'address' in options ? options.address : '192.168.1.20',
  } as Parameters<typeof runMinikubeChecks>[0];
  return { deps, logs, lines };
}

describe('runMinikubeChecks (NFR5.13, NFR5.14, NFR5.15)', () => {
  it('passes when exposure, images, restarts and the output scan are clean', async () => {
    const { deps, logs } = setup();
    await runMinikubeChecks(deps);
    expect(logs.join('\n')).toMatch(/all passed/i);
  });

  it('fails when a non-loopback address accepts a connection', async () => {
    const { deps } = setup({ connect: async () => 'accepted' });
    await expect(runMinikubeChecks(deps)).rejects.toThrow(/NFR5\.13/);
  });

  it('fails on an image that runs as root', async () => {
    const { deps } = setup({ user: 'root' });
    await expect(runMinikubeChecks(deps)).rejects.toThrow(/NFR5\.15.*non-root/);
  });

  it('fails on a pod that restarted', async () => {
    const pods = JSON.stringify({
      items: [
        {
          metadata: { name: 'app-1' },
          status: { containerStatuses: [{ restartCount: 3 }] },
        },
      ],
    });
    const { deps } = setup({ pods });
    await expect(runMinikubeChecks(deps)).rejects.toThrow(/app-1.*3 restart/);
  });

  it('fails, naming where and never the value, when the password is in a pod log', async () => {
    const { deps, logs } = setup({ logs: `connecting with ${PASSWORD}\n` });
    const error = await runMinikubeChecks(deps).catch(e => e);
    expect(error.message).toMatch(/NFR5\.14.*secret.*pod\/app-1 log/);
    expect(error.message).not.toContain(PASSWORD);
    expect(logs.join('\n')).not.toContain(PASSWORD);
  });

  it('fails on token-shaped text in a pod log', async () => {
    const { deps } = setup({
      logs: 'tok eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.c2ln\n',
    });
    await expect(runMinikubeChecks(deps)).rejects.toThrow(/token-shape/);
  });

  it('scans the report folders of the live specs as well', async () => {
    const { deps } = setup();
    const folder = join(deps.root, 'packages', 'e2e', 'dist', 'out', 'report');
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'results.json'), `leaked ${PASSWORD}`);
    await expect(runMinikubeChecks(deps)).rejects.toThrow(/results\.json/);
  });

  it('fails when the password cannot be read, instead of scanning without it', async () => {
    const { deps } = setup({ secret: { status: 1, stdout: '' } });
    await expect(runMinikubeChecks(deps)).rejects.toThrow(
      /could not read the database Secret/i,
    );
  });

  it('counts every failed check in the message', async () => {
    const { deps } = setup({ user: 'root', connect: async () => 'accepted' });
    await expect(runMinikubeChecks(deps)).rejects.toThrow(
      /3 check\(s\) failed/,
    );
  });
});

describe('runClosedCheck (NFR5.22)', () => {
  it('passes when loopback refuses after down', async () => {
    const { deps, logs } = setup({ connect: async () => 'refused' });
    await runClosedCheck(deps);
    expect(logs.join('\n')).toMatch(/closed/i);
  });

  it('fails when the port still answers', async () => {
    const { deps } = setup({ connect: async () => 'accepted' });
    await expect(runClosedCheck(deps)).rejects.toThrow(/NFR5\.22/);
  });
});
