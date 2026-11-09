import type { ErrorCode } from './types';

/**
 * Everything the screens need to know about a failed call. Response bodies,
 * status text and stack traces are discarded at the API layer (NFR5.10): only
 * the error code and the HTTP status survive.
 */
export type Failure =
  /** 503 SERVER_UNREACHABLE: the guardrails server cannot be used. */
  | { kind: 'server-unreachable' }
  /** 401: no sign-in, or the demo session ended. */
  | { kind: 'unauthenticated' }
  /** Lost connection, no answer in time, or an answer that is not C1. */
  | { kind: 'no-answer' }
  /** The plugin backend answered with a C1 error code. */
  | { kind: 'api'; code: ErrorCode; status: number }
  /** An answer the UI does not know. */
  | { kind: 'unknown'; status: number };

export type Result<T> =
  { ok: true; value: T } | { ok: false; failure: Failure };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(failure: Failure): Result<T> => ({
  ok: false,
  failure,
});

const KNOWN_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  'INVALID_INPUT',
  'EMPTY_REASON',
  'UNAUTHENTICATED',
  'AUDITOR_READ_ONLY',
  'SELF_DECISION',
  'NOT_FOUND',
  'ALREADY_DECIDED',
  'NOT_FAILED',
  'NOT_ELIGIBLE',
  'CLAIM_RELEASED',
  'SERVER_UNREACHABLE',
  'INTERNAL_ERROR',
]);

/** Turns an HTTP status and the (untrusted) error code into a Failure. */
export function failureFrom(status: number, code: unknown): Failure {
  if (status === 401) {
    return { kind: 'unauthenticated' };
  }
  if (typeof code === 'string' && KNOWN_CODES.has(code)) {
    if (code === 'SERVER_UNREACHABLE') {
      return { kind: 'server-unreachable' };
    }
    if (code === 'UNAUTHENTICATED') {
      return { kind: 'unauthenticated' };
    }
    return { kind: 'api', code: code as ErrorCode, status };
  }
  return { kind: 'unknown', status };
}
