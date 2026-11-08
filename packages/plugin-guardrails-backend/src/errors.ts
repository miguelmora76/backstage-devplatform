/** Every code the API answers with besides the fixed INTERNAL_ERROR (contract C1). */
export const ERROR_CODES = [
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
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  EMPTY_REASON: 400,
  UNAUTHENTICATED: 401,
  AUDITOR_READ_ONLY: 403,
  SELF_DECISION: 403,
  NOT_FOUND: 404,
  ALREADY_DECIDED: 409,
  NOT_FAILED: 409,
  NOT_ELIGIBLE: 409,
  CLAIM_RELEASED: 409,
  SERVER_UNREACHABLE: 503,
};

const MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: 'The request has an invalid value.',
  EMPTY_REASON: 'A reason is required.',
  UNAUTHENTICATED: 'Sign in as a demo user to use this.',
  AUDITOR_READ_ONLY: 'An auditor can read but not change anything.',
  SELF_DECISION: 'You cannot decide a change you proposed.',
  NOT_FOUND: 'Not found.',
  ALREADY_DECIDED: 'This change has already been decided or is being decided.',
  NOT_FAILED: 'Only a failed change can be retried.',
  NOT_ELIGIBLE: 'This target does not need the change.',
  CLAIM_RELEASED:
    'The decision took too long and was released. Read the change again.',
  SERVER_UNREACHABLE: 'The guardrails server cannot be reached.',
};

/**
 * An error the API answers with a defined status and code. Messages are fixed
 * sentences: they never echo a value from the request (NFR5.6).
 */
export class GuardrailsError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? MESSAGES[code]);
    this.name = 'GuardrailsError';
    this.code = code;
    this.status = STATUS[code];
  }
}
