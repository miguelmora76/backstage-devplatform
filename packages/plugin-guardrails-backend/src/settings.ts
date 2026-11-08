import type { RootConfigService } from '@backstage/backend-plugin-api';
import { CLAIM_RELEASE_MS } from './workflow/recovery';

export interface GuardrailsSettings {
  serverUrl: string;
  readTimeoutMs: number;
  writeTimeoutMs: number;
  demoSignInEnabled: boolean;
}

const DEFAULT_READ_TIMEOUT_MS = 3000;
const DEFAULT_WRITE_TIMEOUT_MS = 10000;

function positiveInteger(
  config: RootConfigService,
  key: string,
  fallback: number,
): number {
  const value = config.getOptionalNumber(key) ?? fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive whole number of milliseconds.`);
  }
  return value;
}

/**
 * Reads the `guardrails.*` settings (contract C3). The server address has no
 * default in code. Error messages name the key and never the value (NFR5.8).
 */
export function readSettings(config: RootConfigService): GuardrailsSettings {
  const key = 'guardrails.server.url';
  const url = config.getOptionalString(key);
  if (!url) {
    throw new Error(
      `Missing setting ${key}: the address of the guardrails server.`,
    );
  }
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error(`${key} must be an http or https address.`);
  }
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`${key} must be an http or https address.`);
  }

  const readTimeoutMs = positiveInteger(
    config,
    'guardrails.server.readTimeoutMs',
    DEFAULT_READ_TIMEOUT_MS,
  );
  const writeTimeoutMs = positiveInteger(
    config,
    'guardrails.server.writeTimeoutMs',
    DEFAULT_WRITE_TIMEOUT_MS,
  );
  if (writeTimeoutMs >= CLAIM_RELEASE_MS) {
    throw new Error(
      `guardrails.server.writeTimeoutMs must be below ${CLAIM_RELEASE_MS} (the claim release time).`,
    );
  }

  return {
    serverUrl: url,
    readTimeoutMs,
    writeTimeoutMs,
    demoSignInEnabled:
      config.getOptionalBoolean('guardrails.demoSignIn.enabled') ?? false,
  };
}
