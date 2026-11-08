/** Domain types and store interfaces (entities.md). Times are ISO 8601 strings. */

export type Role = 'service-owner' | 'platform-engineer' | 'auditor';
export type ChangeKind = 'upgrade' | 'rerun';
export type ChangeStatus =
  'pending' | 'deciding' | 'applied' | 'rejected' | 'failed';
export type DecisionAction = 'approve' | 'reject' | 'retry';
export type AuditAction = 'propose' | DecisionAction;
export type Outcome =
  'proposed' | 'applied' | 'rejected' | 'failed' | 'refused';
export type DecisionOutcome = 'applied' | 'rejected' | 'failed';

export interface NewChange {
  changeId: string;
  kind: ChangeKind;
  service: string;
  target: string;
  summary: string;
  proposedBy: string;
  proposedAt: string;
}

export interface Change extends NewChange {
  status: ChangeStatus;
  decidedBy?: string;
  decisionReason?: string;
  failureMessage?: string;
  decidedAt?: string;
  claimedAt?: string;
  claimToken?: string;
  claimedBy?: string;
  claimedAction?: DecisionAction;
  claimReason?: string;
  claimPreviousStatus?: 'pending' | 'failed';
  decisionCount: number;
  lastAction?: DecisionAction;
  lastOutcome?: DecisionOutcome;
}

export interface NewAuditEntry {
  time: string;
  actor: string;
  action: AuditAction;
  service: string;
  target: string;
  outcome: Outcome;
  reason?: string;
  changeId?: string;
  decisionNumber?: number;
}

export interface AuditEntry extends NewAuditEntry {
  entryId: string;
}

export interface ClaimRequest {
  /** The status the change must have: pending for approve and reject, failed for retry. */
  expectedStatus: 'pending' | 'failed';
  token: string;
  at: string;
  by: string;
  action: DecisionAction;
  reason: string;
}

export interface FinishResult {
  status: 'applied' | 'rejected' | 'failed';
  decidedBy: string;
  reason: string;
  decidedAt: string;
  action: DecisionAction;
  outcome: DecisionOutcome;
  failureMessage?: string;
}

export interface ListChangesQuery {
  statuses?: ChangeStatus[];
  limit: number;
}

export interface AuditQuery {
  from?: string;
  to?: string;
  actor?: string;
  action?: AuditAction;
  outcome?: Outcome;
  page?: number;
  pageSize?: number;
}

export interface AuditPage {
  items: AuditEntry[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * The audit log offers append and read only (BR5.1). There is deliberately no
 * method that changes or removes an entry.
 */
export interface AuditStore {
  /** Appends one entry; the same (changeId, decisionNumber) twice has no effect. */
  append(entry: NewAuditEntry): Promise<void>;
  read(service: string, query: AuditQuery): Promise<AuditPage>;
  /** Which `changeId:decisionNumber` pairs already have an entry. */
  findDecisionKeys(changeIds: string[]): Promise<Set<string>>;
}

export interface ChangeStore {
  /** Inserts a pending change, with its proposal entry in the same transaction when given. */
  insert(change: NewChange, audit?: NewAuditEntry): Promise<Change>;
  get(changeId: string): Promise<Change | undefined>;
  list(service: string, query: ListChangesQuery): Promise<Change[]>;
  /** One atomic conditional update; resolves with the change only for the winner. */
  claim(changeId: string, claim: ClaimRequest): Promise<Change | undefined>;
  /**
   * Writes the final state when the status is still deciding and the claim
   * token is the caller's own. The audit entry, built from the updated change,
   * is appended in the same transaction. Resolves undefined when the claim is gone.
   */
  finish(
    changeId: string,
    token: string,
    result: FinishResult,
    audit?: (updated: Change) => NewAuditEntry,
  ): Promise<Change | undefined>;
  /** Releases every claim older than the cutoff, each with its audit entry in one transaction. */
  releaseStale(cutoff: string, now: string): Promise<Change[]>;
  /** Changes of a service whose latest proposal or decision has no audit entry (BR7.4). */
  findMissingLatestEntries(service: string): Promise<Change[]>;
}
