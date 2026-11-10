import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import {
  forwardArgs,
  ForwardOps,
  isVerifiedForward,
  PID_FILE,
  processQuery,
  realForwardOps,
  startForward,
  stopForward,
} from './portForward';
import { repoRoot } from './repoRoot';
import { realRunner } from './runner';
import { fakeRunner } from './testing/fakeRunner';

function tempDir(): string {
  const base = join(repoRoot(), 'packages', 'e2e', 'dist', 'test-tmp');
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, 'fwd-'));
}

const FORWARD_CMD =
  'kubectl --context minikube -n guardrails-sample port-forward --address 127.0.0.1 svc/app 7007:7007';

interface World {
  /** pid -> command line of the processes that are alive */
  table: Map<number, string>;
  killed: number[];
  spawned: Array<{ command: string; args: string[]; cwd: string }>;
  freeAnswers: boolean[];
  nextPid: number | undefined;
}

function setup(world: Partial<World> = {}) {
  const w: World = {
    table: new Map(),
    killed: [],
    spawned: [],
    freeAnswers: [true],
    nextPid: 4242,
    ...world,
  };
  const ops: ForwardOps = {
    spawnDetached: (command, args, cwd) => {
      w.spawned.push({ command, args, cwd });
      if (w.nextPid !== undefined) {
        w.table.set(w.nextPid, [command, ...args].join(' '));
      }
      return w.nextPid;
    },
    processCommand: pid => w.table.get(pid),
    kill: pid => {
      w.killed.push(pid);
      w.table.delete(pid);
    },
    portFree: async () =>
      w.freeAnswers.length > 1 ? w.freeAnswers.shift()! : w.freeAnswers[0],
    sleep: async () => undefined,
  };
  const root = tempDir();
  const logs: string[] = [];
  return {
    w,
    ops,
    root,
    logs,
    deps: { root, ops, log: (m: string) => logs.push(m) },
  };
}

describe('isVerifiedForward (NFR5.22)', () => {
  it('needs kubectl, port-forward and the sample namespace', () => {
    expect(isVerifiedForward(FORWARD_CMD)).toBe(true);
    expect(isVerifiedForward('kubectl port-forward svc/other 7007:7007')).toBe(
      false,
    );
    expect(isVerifiedForward('node server.js -n guardrails-sample')).toBe(
      false,
    );
    expect(isVerifiedForward('kubectl get pods -n guardrails-sample')).toBe(
      false,
    );
    expect(isVerifiedForward(undefined)).toBe(false);
  });
});

describe('startForward (NFR5.13)', () => {
  it('starts kubectl port-forward on 127.0.0.1, detached, and writes the process id', async () => {
    const { w, root, deps } = setup();
    const pid = await startForward(deps);
    expect(pid).toBe(4242);
    expect(w.spawned).toEqual([
      {
        command: 'kubectl',
        args: [
          '--context',
          'minikube',
          '-n',
          'guardrails-sample',
          'port-forward',
          '--address',
          '127.0.0.1',
          'svc/app',
          '7007:7007',
        ],
        cwd: root,
      },
    ]);
    expect(forwardArgs()).toEqual(w.spawned[0].args);
    expect(readFileSync(join(root, PID_FILE), 'utf8').trim()).toBe('4242');
  });

  it('stops with a plain message when the local port is taken', async () => {
    const { w, root, deps } = setup({ freeAnswers: [false] });
    await expect(startForward(deps)).rejects.toThrow(
      /port 7007.*already in use/i,
    );
    expect(w.spawned).toEqual([]);
    expect(existsSync(join(root, PID_FILE))).toBe(false);
  });

  it('replaces a stale file whose process is gone and kills nothing', async () => {
    const { w, root, deps } = setup();
    writeFileSync(join(root, PID_FILE), '999\n');
    await startForward(deps);
    expect(w.killed).toEqual([]);
    expect(readFileSync(join(root, PID_FILE), 'utf8').trim()).toBe('4242');
  });

  it('ignores a live process that is not the forward and never kills it', async () => {
    const { w, root, deps, logs } = setup({
      table: new Map([[555, 'vim notes.txt']]),
    });
    writeFileSync(join(root, PID_FILE), '555\n');
    await startForward(deps);
    expect(w.killed).toEqual([]);
    expect(w.table.get(555)).toBe('vim notes.txt');
    expect(logs.join('\n')).toMatch(/not the port-forward.*left alone/i);
    expect(readFileSync(join(root, PID_FILE), 'utf8').trim()).toBe('4242');
  });

  it('restarts a forward of an earlier run: stops the verified one, waits for the port, starts a new one', async () => {
    const { w, root, deps } = setup({
      table: new Map([[777, FORWARD_CMD]]),
      freeAnswers: [false, false, true],
    });
    writeFileSync(join(root, PID_FILE), '777\n');
    await startForward(deps);
    expect(w.killed).toEqual([777]);
    expect(w.spawned).toHaveLength(1);
  });

  it('fails when the process could not be started', async () => {
    const { root, deps } = setup({ nextPid: undefined });
    await expect(startForward(deps)).rejects.toThrow(/could not start/i);
    expect(existsSync(join(root, PID_FILE))).toBe(false);
  });
});

describe('stopForward (NFR5.22)', () => {
  it('kills only a verified forward and removes the file', () => {
    const { w, root, deps } = setup({ table: new Map([[321, FORWARD_CMD]]) });
    writeFileSync(join(root, PID_FILE), '321');
    expect(stopForward(deps)).toBe('stopped');
    expect(w.killed).toEqual([321]);
    expect(existsSync(join(root, PID_FILE))).toBe(false);
  });

  it('has nothing to stop without a file', () => {
    const { w, deps } = setup();
    expect(stopForward(deps)).toBe('none');
    expect(w.killed).toEqual([]);
  });

  it('removes a stale file and a garbled file without killing anything', () => {
    const { w, root, deps } = setup();
    writeFileSync(join(root, PID_FILE), '12345');
    expect(stopForward(deps)).toBe('none');
    writeFileSync(join(root, PID_FILE), 'not a number');
    expect(stopForward(deps)).toBe('none');
    expect(w.killed).toEqual([]);
    expect(existsSync(join(root, PID_FILE))).toBe(false);
  });

  it('leaves a live process alone that is not the forward', () => {
    const { w, root, deps } = setup({
      table: new Map([[88, 'postgres: writer process']]),
    });
    writeFileSync(join(root, PID_FILE), '88');
    expect(stopForward(deps)).toBe('left-alone');
    expect(w.killed).toEqual([]);
    expect(existsSync(join(root, PID_FILE))).toBe(false);
  });
});

describe('the real operations', () => {
  it('asks ps on a unix system and PowerShell on Windows for a command line', () => {
    expect(processQuery(12, 'darwin')).toEqual({
      command: 'ps',
      args: ['-p', '12', '-o', 'command='],
    });
    const win = processQuery(12, 'win32');
    expect(win.command).toBe('powershell');
    expect(win.args.join(' ')).toContain('ProcessId=12');
  });

  it('reads a command line through the runner and treats a failed query as gone', () => {
    const found = fakeRunner([
      { when: ['ps'], result: { stdout: ' kubectl x\n' } },
    ]);
    expect(realForwardOps(found.run).processCommand(5)).toBe('kubectl x');
    const gone = fakeRunner([{ when: ['ps'], result: { status: 1 } }]);
    expect(realForwardOps(gone.run).processCommand(5)).toBeUndefined();
  });

  it('tells a free port from a taken one', async () => {
    const ops = realForwardOps(fakeRunner().run);
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as { port: number };
    expect(await ops.portFree(port)).toBe(false);
    await new Promise(resolve => server.close(resolve));
    expect(await ops.portFree(port)).toBe(true);
  });

  it('starts a detached process, finds its command line and ends it', async () => {
    const real = realForwardOps(realRunner);
    const pid = real.spawnDetached(
      process.execPath,
      ['-e', 'setTimeout(() => {}, 20000)'],
      process.cwd(),
    );
    expect(typeof pid).toBe('number');
    expect(real.processCommand(pid!)).toContain('setTimeout');
    real.kill(pid!);
    real.kill(pid!); // a second kill of a gone process is not an error
    for (let i = 0; i < 20 && real.processCommand(pid!); i += 1) {
      await real.sleep(100);
    }
    expect(real.processCommand(pid!)).toBeUndefined();
  });
});
