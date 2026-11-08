import type { Knex } from 'knex';
import type { AuditEntry, Change } from './types';

/** Either a plain connection or a transaction: store helpers accept both. */
export type Db = Knex | Knex.Transaction;

type Row = Record<string, unknown>;

function present(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/** Copies the columns that hold a value, so absent fields stay absent. */
function assignPresent<T extends object>(
  target: T,
  fields: Record<string, [string, (value: unknown) => unknown]>,
  row: Row,
): T {
  for (const [column, [property, convert]] of Object.entries(fields)) {
    if (present(row[column])) {
      (target as Row)[property] = convert(row[column]);
    }
  }
  return target;
}

const asIs = (value: unknown) => value;

/** The one place a changes row becomes a Change. */
export function rowToChange(row: Row): Change {
  const change: Change = {
    changeId: row.change_id as string,
    kind: row.kind as Change['kind'],
    service: row.service as string,
    target: row.target as string,
    summary: row.summary as string,
    proposedBy: row.proposed_by as string,
    status: row.status as Change['status'],
    proposedAt: row.proposed_at as string,
    decisionCount: Number(row.decision_count),
  };
  return assignPresent(
    change,
    {
      decided_by: ['decidedBy', asIs],
      decision_reason: ['decisionReason', asIs],
      failure_message: ['failureMessage', asIs],
      decided_at: ['decidedAt', asIs],
      claimed_at: ['claimedAt', asIs],
      claim_token: ['claimToken', asIs],
      claimed_by: ['claimedBy', asIs],
      claimed_action: ['claimedAction', asIs],
      claim_reason: ['claimReason', asIs],
      claim_previous_status: ['claimPreviousStatus', asIs],
      last_action: ['lastAction', asIs],
      last_outcome: ['lastOutcome', asIs],
    },
    row,
  );
}

/** The one place an audit_entries row becomes an AuditEntry. */
export function rowToEntry(row: Row): AuditEntry {
  const entry: AuditEntry = {
    entryId: String(row.entry_id),
    time: row.time as string,
    actor: row.actor as string,
    action: row.action as AuditEntry['action'],
    service: row.service as string,
    target: row.target as string,
    outcome: row.outcome as AuditEntry['outcome'],
  };
  return assignPresent(
    entry,
    {
      reason: ['reason', asIs],
      change_id: ['changeId', asIs],
      decision_number: ['decisionNumber', Number],
    },
    row,
  );
}
