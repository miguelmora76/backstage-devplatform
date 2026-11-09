import type {
  ActionName,
  AllowedAction,
  Change,
  ChangeStatus,
  CiRunItem,
  PlanItem,
} from '../api/types';
import { reasonKey, t, type TextKey } from '../texts/texts';

/** Rows per page for every paged list (D3). */
export const PAGE_SIZE = 10;

/**
 * These functions only arrange what the backend returned. None of them decides
 * who may do what: that is the backend's answer (BR5.3, NFR5.8).
 */

export function cardCounts(
  plan: readonly PlanItem[],
  ci: readonly CiRunItem[],
  open: readonly Change[],
) {
  return {
    upgrades: plan.filter(p => p.currentVersion !== p.recommendedVersion)
      .length,
    failedRuns: ci.length,
    open: open.length,
  };
}

/** Failed first, then pending, each newest first (D6). */
export function sortOpenChanges(changes: readonly Change[]): Change[] {
  const rank = (c: Change) => (c.status === 'failed' ? 0 : 1);
  return [...changes].sort(
    (a, b) => rank(a) - rank(b) || b.proposedAt.localeCompare(a.proposedAt),
  );
}

export function pageCount(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

export function slicePage<T>(
  items: readonly T[],
  page: number,
  size: number = PAGE_SIZE,
): T[] {
  return items.slice((page - 1) * size, page * size);
}

/** Which actions Screen C shows follows the change's status (D11). */
export function decisionActionsFor(status: ChangeStatus): ActionName[] {
  if (status === 'pending') return ['approve', 'reject'];
  if (status === 'failed') return ['retry'];
  return [];
}

export interface ActionState {
  enabled: boolean;
  reasonKey?: TextKey;
}

/** Enabled only when the backend lists the action as allowed (NFR5.8). */
export function actionState(
  allowed: readonly AllowedAction[],
  action: ActionName,
): ActionState {
  const found = allowed.find(a => a.action === action);
  if (found?.allowed) {
    return { enabled: true };
  }
  const key = found?.reason ? reasonKey(found.reason) : undefined;
  return key ? { enabled: false, reasonKey: key } : { enabled: false };
}

/**
 * The title of a change is the `summary` the backend wrote (D10). Only a
 * change without one (an older record) gets a plain fallback built from the
 * kind label and the target; the UI composes no other sentence.
 */
export function changeTitle(
  change: Pick<Change, 'summary' | 'kind' | 'target'>,
): string {
  if (change.summary) return change.summary;
  return `${t(change.kind === 'upgrade' ? 'text.kindUpgrade' : 'text.kindRerun')}: ${change.target}`;
}

/** To before From, both set (BR4.2). Dates are `YYYY-MM-DD`, so text order is date order. */
export function dateRangeInvalid(from: string, to: string): boolean {
  return Boolean(from) && Boolean(to) && to < from;
}
