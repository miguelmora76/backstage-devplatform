import { findDemoUser, type DemoUser } from '../identity/demoUsers';
import {
  actionRefusal,
  allowedActionsForChange,
  allowedActionForPropose,
} from './allowedActions';

const sam = findDemoUser('sam') as DemoUser;
const priya = findDemoUser('priya') as DemoUser;
const alex = findDemoUser('alex') as DemoUser;

const byAction = (list: ReturnType<typeof allowedActionsForChange>) =>
  Object.fromEntries(list.map(a => [a.action, a]));

describe('allowed actions for a change', () => {
  it('allows approve and reject for another user on a pending change; retry is not failed', () => {
    const result = allowedActionsForChange({
      actor: priya,
      change: { status: 'pending', proposedBy: 'sam' },
      reachable: true,
    });
    expect(result.map(a => a.action)).toEqual(['approve', 'reject', 'retry']);
    expect(byAction(result)).toMatchObject({
      approve: { allowed: true },
      reject: { allowed: true },
      retry: { allowed: false, reason: 'NOT_FAILED' },
    });
    expect(byAction(result).approve.reason).toBeUndefined();
  });

  it('allows retry on a failed change for someone other than the proposer', () => {
    const result = byAction(
      allowedActionsForChange({
        actor: priya,
        change: { status: 'failed', proposedBy: 'sam' },
        reachable: true,
      }),
    );
    expect(result.retry.allowed).toBe(true);
    expect(result.approve).toMatchObject({
      allowed: false,
      reason: 'NOT_PENDING',
    });
    expect(result.reject).toMatchObject({
      allowed: false,
      reason: 'NOT_PENDING',
    });
  });

  it('gives the reason in the fixed order: server, auditor, proposer, in progress, state', () => {
    const reasons = (
      actor: DemoUser,
      status: 'pending' | 'deciding' | 'applied' | 'failed',
      reachable: boolean,
      proposedBy = 'sam',
    ) =>
      allowedActionsForChange({
        actor,
        change: { status, proposedBy },
        reachable,
      }).map(a => a.reason);

    // 1 server unreachable beats everything
    expect(reasons(alex, 'pending', false)).toEqual([
      'SERVER_UNREACHABLE',
      'SERVER_UNREACHABLE',
      'SERVER_UNREACHABLE',
    ]);
    // 2 auditor beats proposer and state
    expect(reasons(alex, 'applied', true, 'alex')).toEqual([
      'AUDITOR_READ_ONLY',
      'AUDITOR_READ_ONLY',
      'AUDITOR_READ_ONLY',
    ]);
    // 3 proposer beats in progress and state reasons
    expect(reasons(sam, 'deciding', true)).toEqual([
      'PROPOSER_CANNOT_DECIDE',
      'PROPOSER_CANNOT_DECIDE',
      'PROPOSER_CANNOT_DECIDE',
    ]);
    // 4 in progress beats state
    expect(reasons(priya, 'deciding', true)).toEqual([
      'IN_PROGRESS',
      'IN_PROGRESS',
      'IN_PROGRESS',
    ]);
    // 5 state reasons
    expect(reasons(priya, 'applied', true)).toEqual([
      'NOT_PENDING',
      'NOT_PENDING',
      'NOT_FAILED',
    ]);
  });

  it('disables reject too while the server is unreachable', () => {
    const result = byAction(
      allowedActionsForChange({
        actor: priya,
        change: { status: 'pending', proposedBy: 'sam' },
        reachable: false,
      }),
    );
    expect(result.reject).toMatchObject({
      allowed: false,
      reason: 'SERVER_UNREACHABLE',
    });
  });
});

describe('allowed action for propose', () => {
  it('allows propose for a service owner and a platform engineer', () => {
    expect(allowedActionForPropose({ actor: sam, reachable: true })).toEqual({
      action: 'propose',
      allowed: true,
    });
    expect(
      allowedActionForPropose({ actor: priya, reachable: true }).allowed,
    ).toBe(true);
  });

  it('follows the order server, auditor, already current', () => {
    expect(
      allowedActionForPropose({
        actor: alex,
        reachable: false,
        alreadyCurrent: true,
      }).reason,
    ).toBe('SERVER_UNREACHABLE');
    expect(
      allowedActionForPropose({
        actor: alex,
        reachable: true,
        alreadyCurrent: true,
      }).reason,
    ).toBe('AUDITOR_READ_ONLY');
    expect(
      allowedActionForPropose({
        actor: sam,
        reachable: true,
        alreadyCurrent: true,
      }).reason,
    ).toBe('ALREADY_CURRENT');
  });
});

describe('role refusals used by writes', () => {
  it('refuses an auditor on every action, including propose', () => {
    for (const action of ['propose', 'approve', 'reject', 'retry'] as const) {
      expect(actionRefusal(alex, action, { proposedBy: 'sam' })).toBe(
        'AUDITOR_READ_ONLY',
      );
    }
  });

  it('refuses the proposer on approve, reject and retry but not propose', () => {
    for (const action of ['approve', 'reject', 'retry'] as const) {
      expect(actionRefusal(sam, action, { proposedBy: 'sam' })).toBe(
        'PROPOSER_CANNOT_DECIDE',
      );
    }
    expect(actionRefusal(sam, 'propose')).toBeUndefined();
  });

  it('allows another non-auditor user', () => {
    expect(
      actionRefusal(priya, 'approve', { proposedBy: 'sam' }),
    ).toBeUndefined();
  });
});
