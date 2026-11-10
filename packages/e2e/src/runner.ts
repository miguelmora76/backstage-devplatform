import { spawnSync } from 'node:child_process';

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  /** Set when the command could not be started at all. */
  error?: string;
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Pass the child's output straight through to this terminal. */
  inherit?: boolean;
  /** Stop the command after this many milliseconds (reported as an error). */
  timeoutMs?: number;
  /** Written to the child's standard input (never put a secret in an argument). */
  input?: string;
}

/** Every docker call goes through one function so tests can replace it. */
export type Runner = (
  command: string,
  args: string[],
  options?: RunOptions,
) => CommandResult;

export const realRunner: Runner = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeoutMs,
    input: options.input,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? result.error.message : undefined,
  };
};
