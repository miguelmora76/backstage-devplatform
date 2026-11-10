import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { kubectlArgs, NAMESPACE } from './minikubeArgs';
import { Runner } from './runner';

/** Untracked (listed in .gitignore): the process id of the port-forward (NFR5.22). */
export const PID_FILE = '.minikube-forward.pid';
export const LOCAL_PORT = 7007;

/** What the forward needs from the machine; tests replace all of it. */
export interface ForwardOps {
  /** Starts a detached process and returns its id (undefined when it did not start). */
  spawnDetached(
    command: string,
    args: string[],
    cwd: string,
  ): number | undefined;
  /** The command line of a live process, or undefined when it is gone. */
  processCommand(pid: number): string | undefined;
  kill(pid: number): void;
  portFree(port: number): Promise<boolean>;
  sleep(ms: number): Promise<void>;
}

export interface ForwardDeps {
  root: string;
  ops: ForwardOps;
  log: (message: string) => void;
}

/** The arguments of the one host-side entry: loopback only (NFR5.13). */
export function forwardArgs(): string[] {
  return kubectlArgs([
    'port-forward',
    '--address',
    '127.0.0.1',
    'svc/app',
    `${LOCAL_PORT}:${LOCAL_PORT}`,
  ]);
}

/**
 * True only for the port-forward of this sample. Before the script trusts or
 * ends a process id from the file, the process's command line must show all
 * three, so a recycled process id is never killed (NFR5.22).
 */
export function isVerifiedForward(command: string | undefined): boolean {
  return (
    command !== undefined &&
    command.includes('kubectl') &&
    command.includes('port-forward') &&
    command.includes(NAMESPACE)
  );
}

const pidPath = (root: string) => join(root, PID_FILE);

function readPid(root: string): number | undefined {
  const path = pidPath(root);
  if (!existsSync(path)) return undefined;
  const pid = Number(readFileSync(path, 'utf8').trim());
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

export type StopResult = 'stopped' | 'none' | 'left-alone';

/**
 * Ends the forward named in the file, but only after checking the process is
 * the forward. A stale or garbled file is removed and nothing is killed.
 */
export function stopForward(deps: ForwardDeps): StopResult {
  const exists = existsSync(pidPath(deps.root));
  const pid = readPid(deps.root);
  if (!exists) return 'none';
  rmFile(deps.root);
  if (pid === undefined) return 'none';
  const command = deps.ops.processCommand(pid);
  if (command === undefined) return 'none';
  if (!isVerifiedForward(command)) {
    deps.log(
      `Process ${pid} from ${PID_FILE} is not the port-forward of this sample, so it was left alone.`,
    );
    return 'left-alone';
  }
  deps.ops.kill(pid);
  return 'stopped';
}

function rmFile(root: string): void {
  rmSync(pidPath(root), { force: true });
}

const PORT_WAIT_TRIES = 25;

/**
 * Starts `kubectl port-forward` bound to 127.0.0.1 only and records its
 * process id. A forward of an earlier run is ended first (after the command
 * line check); a taken port stops the start with a plain message.
 */
export async function startForward(deps: ForwardDeps): Promise<number> {
  stopForward(deps);
  let free = await deps.ops.portFree(LOCAL_PORT);
  for (let i = 0; !free && i < PORT_WAIT_TRIES; i += 1) {
    await deps.ops.sleep(200);
    free = await deps.ops.portFree(LOCAL_PORT);
  }
  if (!free) {
    throw new Error(
      `Port ${LOCAL_PORT} on this machine is already in use by another program, so the sample cannot be reached on http://localhost:${LOCAL_PORT}. Stop that program (or run "yarn compose:down" if the compose run is up) and try again.`,
    );
  }
  const pid = deps.ops.spawnDetached('kubectl', forwardArgs(), deps.root);
  if (pid === undefined) {
    throw new Error(
      'Could not start "kubectl port-forward". Check that kubectl is installed and try again.',
    );
  }
  writeFileSync(pidPath(deps.root), `${pid}\n`, { mode: 0o600 });
  return pid;
}

/** The query that reads a process's command line on this platform. */
export function processQuery(
  pid: number,
  platform: NodeJS.Platform = process.platform,
): { command: string; args: string[] } {
  if (platform === 'win32') {
    return {
      command: 'powershell',
      args: [
        '-NoProfile',
        '-Command',
        `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`,
      ],
    };
  }
  return { command: 'ps', args: ['-p', String(pid), '-o', 'command='] };
}

/** The real operations on this machine. */
export function realForwardOps(run: Runner): ForwardOps {
  return {
    spawnDetached: (command, args, cwd) => {
      const child = spawn(command, args, {
        cwd,
        detached: true,
        stdio: 'ignore',
      });
      child.on('error', () => undefined);
      child.unref();
      return child.pid;
    },
    processCommand: pid => {
      const query = processQuery(pid);
      const result = run(query.command, query.args);
      const text = result.stdout.trim();
      return result.status === 0 && !result.error && text !== ''
        ? text
        : undefined;
    },
    kill: pid => {
      try {
        process.kill(pid);
      } catch {
        // Already gone: the goal of the call is met.
      }
    },
    portFree: port =>
      new Promise(resolve => {
        const probe = createServer();
        probe.once('error', () => resolve(false));
        probe.listen(port, '127.0.0.1', () => {
          probe.close(() => resolve(true));
        });
      }),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  };
}
