import type { ServerSettings } from './settings';

export interface CallLogEntry {
  tool: string;
  /** Written only when it looks like a service name; the handler passes a known name or nothing. */
  service: string | undefined;
  /** `ok` or one of the fixed error codes. */
  result: string;
  ms: number;
}

export interface Logger {
  start(settings: ServerSettings): void;
  call(entry: CallLogEntry): void;
}

export interface LoggerOptions {
  write?: (line: string) => void;
  now?: () => Date;
}

// Service names are lowercase words joined by hyphens (BR1.4); anything else
// is shown as a single dash so caller text can never reach the log (NFR1.7).
const SERVICE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_SERVICE_LENGTH = 64;

/**
 * The only code that writes to standard output: a start line and one line per
 * call, plain text with the UTC time first and key=value pairs after it.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const write =
    options.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  const now = options.now ?? (() => new Date());

  return {
    start(settings) {
      write(
        `${now().toISOString()} start seed=${settings.seed} failure=${settings.failureMode} port=${settings.port}`,
      );
    },
    call(entry) {
      const service =
        entry.service !== undefined &&
        entry.service.length <= MAX_SERVICE_LENGTH &&
        SERVICE_NAME.test(entry.service)
          ? entry.service
          : '-';
      write(
        `${now().toISOString()} call tool=${entry.tool} service=${service} result=${entry.result} ms=${Math.round(entry.ms)}`,
      );
    },
  };
}
