/**
 * Table and column names, written once. These are the only fragments of text
 * that are ever put into a statement besides bound values (NFR5.7).
 */
export const CHANGES_TABLE = 'changes';
export const AUDIT_TABLE = 'audit_entries';

export const CHANGE_COLUMNS = [
  'change_id',
  'kind',
  'service',
  'target',
  'summary',
  'proposed_by',
  'status',
  'decided_by',
  'decision_reason',
  'failure_message',
  'proposed_at',
  'decided_at',
  'claimed_at',
  'claim_token',
  'claimed_by',
  'claimed_action',
  'claim_reason',
  'claim_previous_status',
  'decision_count',
  'last_action',
  'last_outcome',
] as const;

export const AUDIT_COLUMNS = [
  'entry_id',
  'time',
  'actor',
  'action',
  'service',
  'target',
  'outcome',
  'reason',
  'change_id',
  'decision_number',
] as const;

export type ChangeColumn = (typeof CHANGE_COLUMNS)[number];
export type AuditColumn = (typeof AUDIT_COLUMNS)[number];
