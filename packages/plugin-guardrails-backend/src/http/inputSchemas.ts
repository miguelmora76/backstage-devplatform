import { z } from 'zod';
import { GuardrailsError } from '../errors';
import type {
  AuditAction,
  AuditQuery,
  ChangeKind,
  Outcome,
} from '../store/types';

export const MAX_REASON_LENGTH = 2000;
const MAX_NAME_LENGTH = 200;
export const MAX_PAGE_SIZE = 100;

const AUDIT_ACTIONS = ['propose', 'approve', 'reject', 'retry'] as const;
const OUTCOMES = [
  'proposed',
  'applied',
  'rejected',
  'failed',
  'refused',
] as const;
export const CHANGE_STATUS_FILTERS = [
  'open',
  'pending',
  'applied',
  'rejected',
  'failed',
] as const;
export type ChangeStatusFilter = (typeof CHANGE_STATUS_FILTERS)[number];

/**
 * Turns a failed check into INVALID_INPUT. The message names the field and
 * never the submitted value (NFR5.6).
 */
function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const field = result.error.issues[0]?.path[0];
  throw new GuardrailsError(
    'INVALID_INPUT',
    typeof field === 'string'
      ? `Invalid value for "${field}".`
      : 'Invalid request.',
  );
}

const name = (max = MAX_NAME_LENGTH) => z.string().min(1).max(max);

/** Unknown fields are removed by zod's default object handling. */
const proposeSchema = z.object({
  kind: z.enum(['upgrade', 'rerun']),
  target: name(),
});

const decisionSchema = z.object({
  // An empty or blank reason is EMPTY_REASON at a later step (security-design.md step 4).
  reason: z.string().max(MAX_REASON_LENGTH),
});

const changesQuerySchema = z.object({
  status: z.enum(CHANGE_STATUS_FILTERS).default('open'),
});

const isoDate = z
  .string()
  .datetime({ offset: true })
  .refine(value => !Number.isNaN(Date.parse(value)))
  .transform(value => new Date(value).toISOString());

const wholeNumber = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d{1,9}$/)
    .transform(Number)
    .refine(value => value >= min && value <= max);

const auditQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  actor: name().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  outcome: z.enum(OUTCOMES).optional(),
  page: wholeNumber(1, 1_000_000).optional(),
  pageSize: wholeNumber(1, MAX_PAGE_SIZE).optional(),
});

export function parseProposeBody(body: unknown): {
  kind: ChangeKind;
  target: string;
} {
  return parse(proposeSchema, body);
}

export function parseDecisionBody(body: unknown): { reason: string } {
  return parse(decisionSchema, body);
}

export function parseChangesQuery(query: unknown): {
  status: ChangeStatusFilter;
} {
  return parse(changesQuerySchema, query ?? {});
}

export function parseAuditQuery(query: unknown): AuditQuery {
  const parsed = parse(auditQuerySchema, query ?? {});
  const result: AuditQuery = {};
  if (parsed.from !== undefined) result.from = parsed.from;
  if (parsed.to !== undefined) result.to = parsed.to;
  if (parsed.actor !== undefined) result.actor = parsed.actor;
  if (parsed.action !== undefined) result.action = parsed.action as AuditAction;
  if (parsed.outcome !== undefined) result.outcome = parsed.outcome as Outcome;
  if (parsed.page !== undefined) result.page = parsed.page;
  if (parsed.pageSize !== undefined) result.pageSize = parsed.pageSize;
  return result;
}

export function parseService(value: unknown): string {
  return parse(z.object({ service: name() }), { service: value }).service;
}

export function parseChangeId(value: unknown): string {
  return parse(z.object({ changeId: name() }), { changeId: value }).changeId;
}
