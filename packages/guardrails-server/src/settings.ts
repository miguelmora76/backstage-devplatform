import { DEFAULT_SEED } from './generator';

export type FailureMode = 'on' | 'off';

/** Start-up settings. Read once at start and never changed while running. */
export interface ServerSettings {
  seed: number;
  failureMode: FailureMode;
  port: number;
}

export type SettingsResult =
  { ok: true; settings: ServerSettings } | { ok: false; message: string };

type Env = Readonly<Record<string, string | undefined>>;

const MAX_PORT = 65535;

/**
 * Reads and validates GUARDRAILS_SEED, GUARDRAILS_FAILURE_MODE and PORT
 * (BR3.2, NFR5.4). A failure is one fixed sentence that names the setting and
 * the expected form, never the offending value.
 */
export function readSettings(env: Env): SettingsResult {
  const seed = readSeed(env.GUARDRAILS_SEED);
  if (seed === undefined) {
    return {
      ok: false,
      message: 'Invalid GUARDRAILS_SEED: expected a whole number.',
    };
  }
  const failureMode = readFailureMode(env.GUARDRAILS_FAILURE_MODE);
  if (failureMode === undefined) {
    return {
      ok: false,
      message: 'Invalid GUARDRAILS_FAILURE_MODE: expected on or off.',
    };
  }
  const port = readPort(env.PORT);
  if (port === undefined) {
    return {
      ok: false,
      message: `Invalid PORT: expected a whole number from 1 to ${MAX_PORT}.`,
    };
  }
  return { ok: true, settings: { seed, failureMode, port } };
}

function readSeed(value: string | undefined): number | undefined {
  if (value === undefined) {
    return DEFAULT_SEED;
  }
  if (!/^-?\d+$/.test(value)) {
    return undefined;
  }
  const seed = Number(value);
  return Number.isSafeInteger(seed) ? seed : undefined;
}

function readFailureMode(value: string | undefined): FailureMode | undefined {
  if (value === undefined) {
    return 'off';
  }
  return value === 'on' || value === 'off' ? value : undefined;
}

function readPort(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) {
    return undefined;
  }
  const port = Number(value);
  return port >= 1 && port <= MAX_PORT ? port : undefined;
}
