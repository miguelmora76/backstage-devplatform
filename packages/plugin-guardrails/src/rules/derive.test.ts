import {
  actionState,
  cardCounts,
  dateRangeInvalid,
  decisionActionsFor,
  pageCount,
  slicePage,
  sortOpenChanges,
} from './derive';
import type { Change, PlanItem } from '../api/types';

const user = { userId: 'sam', name: 'Sam', role: 'service-owner' as const };
const change = (
  id: string,
  status: Change['status'],
  proposedAt: string,
): Change => ({
  changeId: id,
  kind: 'upgrade',
  service: 'pay',
  target: 'x',
  proposedBy: user,
  status,
  proposedAt,
  allowedActions: [],
});

describe('card counts (BR1.4)', () => {
  const plan = [
    { currentVersion: '1.0', recommendedVersion: '2.0' },
    { currentVersion: '3.0', recommendedVersion: '3.0' },
    { currentVersion: '4.0', recommendedVersion: '4.1' },
  ] as PlanItem[];

  it('counts upgrades whose recommended version differs, failed runs and open changes', () => {
    expect(
      cardCounts(plan, [{}, {}] as never, [change('a', 'pending', 'x')]),
    ).toEqual({
      upgrades: 2,
      failedRuns: 2,
      open: 1,
    });
  });

  it('is all zero for empty lists', () => {
    expect(cardCounts([], [], [])).toEqual({
      upgrades: 0,
      failedRuns: 0,
      open: 0,
    });
  });
});

describe('open changes order (D6)', () => {
  it('lists failed first then pending, each newest first', () => {
    const sorted = sortOpenChanges([
      change('p-old', 'pending', '2026-11-06T08:00:00.000Z'),
      change('f-old', 'failed', '2026-11-06T07:00:00.000Z'),
      change('p-new', 'pending', '2026-11-06T09:00:00.000Z'),
      change('f-new', 'failed', '2026-11-06T09:30:00.000Z'),
    ]);
    expect(sorted.map(c => c.changeId)).toEqual([
      'f-new',
      'f-old',
      'p-new',
      'p-old',
    ]);
  });

  it('does not change the list it was given', () => {
    const input = [change('a', 'pending', '1'), change('b', 'failed', '2')];
    sortOpenChanges(input);
    expect(input.map(c => c.changeId)).toEqual(['a', 'b']);
  });
});

describe('paging (D3)', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('slices 10 rows per page', () => {
    expect(slicePage(items, 1)).toHaveLength(10);
    expect(slicePage(items, 3)).toEqual([21, 22, 23, 24, 25]);
  });

  it('computes the page count with a minimum of 1', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(10)).toBe(1);
    expect(pageCount(11)).toBe(2);
    expect(pageCount(25)).toBe(3);
  });

  it('gives an empty page past the end', () => {
    expect(slicePage(items, 9)).toEqual([]);
  });
});

describe('which decision actions show (D11)', () => {
  it('shows approve and reject for pending, retry for failed, nothing for decided', () => {
    expect(decisionActionsFor('pending')).toEqual(['approve', 'reject']);
    expect(decisionActionsFor('failed')).toEqual(['retry']);
    expect(decisionActionsFor('applied')).toEqual([]);
    expect(decisionActionsFor('rejected')).toEqual([]);
  });
});

describe('action state from the backend answer (BR3.5, NFR5.8)', () => {
  const allowed = [
    { action: 'approve', allowed: true },
    { action: 'reject', allowed: false, reason: 'PROPOSER_CANNOT_DECIDE' },
    { action: 'retry', allowed: false, reason: 'NOT_FAILED' },
  ] as const;

  it('is enabled when the backend lists the action as allowed', () => {
    expect(actionState([...allowed], 'approve')).toEqual({ enabled: true });
  });

  it('is disabled with the catalog key of the backend reason', () => {
    expect(actionState([...allowed], 'reject')).toEqual({
      enabled: false,
      reasonKey: 'disabled.proposer',
    });
  });

  it('is disabled with no text for NOT_PENDING and NOT_FAILED', () => {
    expect(actionState([...allowed], 'retry')).toEqual({ enabled: false });
  });

  it('is disabled when the backend did not list the action at all', () => {
    expect(actionState([], 'approve')).toEqual({ enabled: false });
  });

  it('is disabled with the generic text for an unknown reason', () => {
    expect(
      actionState(
        [{ action: 'approve', allowed: false, reason: 'NEW' }],
        'approve',
      ),
    ).toEqual({ enabled: false, reasonKey: 'error.generic' });
  });

  it('is disabled when allowed is false even if no reason came', () => {
    expect(
      actionState([{ action: 'approve', allowed: false }], 'approve'),
    ).toEqual({ enabled: false });
  });
});

describe('date range (BR4.2)', () => {
  it('is invalid only when both dates are set and To is before From', () => {
    expect(dateRangeInvalid('2026-11-05', '2026-11-04')).toBe(true);
    expect(dateRangeInvalid('2026-11-05', '2026-11-05')).toBe(false);
    expect(dateRangeInvalid('2026-11-05', '')).toBe(false);
    expect(dateRangeInvalid('', '2026-11-04')).toBe(false);
  });
});
