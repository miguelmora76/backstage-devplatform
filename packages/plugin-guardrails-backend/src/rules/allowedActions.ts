import type { DemoUser } from '../identity/demoUsers';
import type { AuditAction, Change, DecisionAction } from '../store/types';

/** The reasons an action can be disabled, in the order they apply (BR6.2). */
export const REASONS = [
  'SERVER_UNREACHABLE',
  'AUDITOR_READ_ONLY',
  'PROPOSER_CANNOT_DECIDE',
  'IN_PROGRESS',
  'NOT_PENDING',
  'NOT_FAILED',
  'ALREADY_CURRENT',
] as const;

export type Reason = (typeof REASONS)[number];

export interface AllowedAction {
  action: AuditAction;
  allowed: boolean;
  reason?: Reason;
}

export type RoleRefusal = 'AUDITOR_READ_ONLY' | 'PROPOSER_CANNOT_DECIDE';

const DECISION_ACTIONS: DecisionAction[] = ['approve', 'reject', 'retry'];

/**
 * The role rules, in one place for reads and writes (NFR5.4): an auditor may
 * do nothing but read; the proposer may not decide their own change.
 */
export function actionRefusal(
  actor: DemoUser,
  action: AuditAction,
  change?: Pick<Change, 'proposedBy'>,
): RoleRefusal | undefined {
  if (actor.role === 'auditor') {
    return 'AUDITOR_READ_ONLY';
  }
  if (action !== 'propose' && change && change.proposedBy === actor.userId) {
    return 'PROPOSER_CANNOT_DECIDE';
  }
  return undefined;
}

function decorate(action: AuditAction, reason?: Reason): AllowedAction {
  return reason
    ? { action, allowed: false, reason }
    : { action, allowed: true };
}

function stateReason(
  action: DecisionAction,
  status: Change['status'],
): Reason | undefined {
  if (action === 'retry') {
    return status === 'failed' ? undefined : 'NOT_FAILED';
  }
  return status === 'pending' ? undefined : 'NOT_PENDING';
}

/** Approve, reject and retry for one reader, with the first reason that applies (BR6.2). */
export function allowedActionsForChange(input: {
  actor: DemoUser;
  change: Pick<Change, 'status' | 'proposedBy'>;
  reachable: boolean;
}): AllowedAction[] {
  const { actor, change, reachable } = input;
  return DECISION_ACTIONS.map(action => {
    if (!reachable) return decorate(action, 'SERVER_UNREACHABLE');
    const role = actionRefusal(actor, action, change);
    if (role) return decorate(action, role);
    if (change.status === 'deciding') return decorate(action, 'IN_PROGRESS');
    return decorate(action, stateReason(action, change.status));
  });
}

/** The propose action on a plan row or a failed run. */
export function allowedActionForPropose(input: {
  actor: DemoUser;
  reachable: boolean;
  alreadyCurrent?: boolean;
}): AllowedAction {
  if (!input.reachable) return decorate('propose', 'SERVER_UNREACHABLE');
  const role = actionRefusal(input.actor, 'propose');
  if (role) return decorate('propose', role);
  return decorate(
    'propose',
    input.alreadyCurrent ? 'ALREADY_CURRENT' : undefined,
  );
}
