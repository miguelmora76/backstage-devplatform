// Types written from the C1 interface file
// (packages/plugin-guardrails-backend/contract/c1-openapi.yaml). Consumers
// ignore unknown fields; the contract test keeps these and the file in step.

export type Role = 'service-owner' | 'platform-engineer' | 'auditor';

export interface DemoUser {
  userId: string;
  name: string;
  role: Role;
}

export type ActionName = 'propose' | 'approve' | 'reject' | 'retry';

export type DisabledReason =
  | 'SERVER_UNREACHABLE'
  | 'AUDITOR_READ_ONLY'
  | 'PROPOSER_CANNOT_DECIDE'
  | 'IN_PROGRESS'
  | 'NOT_PENDING'
  | 'NOT_FAILED'
  | 'ALREADY_CURRENT';

export interface AllowedAction {
  action: ActionName;
  allowed: boolean;
  reason?: DisabledReason | string;
}

export interface PlanItem {
  dependencyKey: string;
  name: string;
  currentVersion: string;
  recommendedVersion: string;
  allowedActions: AllowedAction[];
}

export interface CiRunItem {
  runKey: string;
  runNumber: number;
  status: string;
  cause: string;
  allowedActions: AllowedAction[];
}

export type ChangeKind = 'upgrade' | 'rerun';
export type ChangeStatus = 'pending' | 'applied' | 'rejected' | 'failed';

export interface Change {
  changeId: string;
  kind: ChangeKind;
  service: string;
  target: string;
  summary?: string;
  proposedBy: DemoUser;
  status: ChangeStatus;
  decidedBy?: DemoUser;
  decisionReason?: string;
  failureMessage?: string;
  proposedAt: string;
  decidedAt?: string;
  allowedActions: AllowedAction[];
}

export type AuditAction = 'propose' | 'approve' | 'reject' | 'retry';
export type Outcome =
  'proposed' | 'applied' | 'rejected' | 'failed' | 'refused';

export interface AuditEntry {
  entryId: string;
  time: string;
  actor: DemoUser;
  action: AuditAction;
  service: string;
  target: string;
  outcome: Outcome;
  reason?: string;
  changeId?: string;
}

export interface AuditPage {
  items: AuditEntry[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AuditFilters {
  /** Inclusive lower bound, a date-time string. */
  from?: string;
  /** Inclusive upper bound, a date-time string. */
  to?: string;
  /** A userId from the demo user list. */
  actor?: string;
  action?: AuditAction;
  outcome?: Outcome;
}

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'EMPTY_REASON'
  | 'UNAUTHENTICATED'
  | 'AUDITOR_READ_ONLY'
  | 'SELF_DECISION'
  | 'NOT_FOUND'
  | 'ALREADY_DECIDED'
  | 'NOT_FAILED'
  | 'NOT_ELIGIBLE'
  | 'CLAIM_RELEASED'
  | 'SERVER_UNREACHABLE'
  | 'INTERNAL_ERROR';
