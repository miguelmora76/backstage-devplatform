import type { Knex } from 'knex';
import { AUDIT_TABLE, CHANGES_TABLE } from '../database/tables';
import { appendAuditRow } from './auditStore';
import { type Db, rowToChange } from './rows';
import type {
  Change,
  ChangeStore,
  ClaimRequest,
  FinishResult,
  ListChangesQuery,
  NewAuditEntry,
  NewChange,
} from './types';

/** Written once: clearing these columns ends a claim (entities.md). */
const CLEARED_CLAIM = {
  claimed_at: null,
  claim_token: null,
  claimed_by: null,
  claimed_action: null,
  claim_reason: null,
  claim_previous_status: null,
};

export const INTERRUPTED_MESSAGE = 'Interrupted';

async function readChange(
  db: Db,
  changeId: string,
): Promise<Change | undefined> {
  const row = await db(CHANGES_TABLE).where('change_id', changeId).first();
  return row ? rowToChange(row) : undefined;
}

class KnexChangeStore implements ChangeStore {
  constructor(private readonly knex: Knex) {}

  async insert(change: NewChange, audit?: NewAuditEntry): Promise<Change> {
    await this.knex.transaction(async trx => {
      await trx(CHANGES_TABLE).insert({
        change_id: change.changeId,
        kind: change.kind,
        service: change.service,
        target: change.target,
        summary: change.summary,
        proposed_by: change.proposedBy,
        status: 'pending',
        proposed_at: change.proposedAt,
        decision_count: 0,
      });
      if (audit) {
        await appendAuditRow(trx, audit);
      }
    });
    return (await readChange(this.knex, change.changeId)) as Change;
  }

  get(changeId: string): Promise<Change | undefined> {
    return readChange(this.knex, changeId);
  }

  async list(service: string, query: ListChangesQuery): Promise<Change[]> {
    const q = this.knex(CHANGES_TABLE).where('service', service);
    if (query.statuses && query.statuses.length > 0) {
      q.whereIn('status', query.statuses);
    }
    const rows = await q
      .orderBy([
        { column: 'proposed_at', order: 'desc' },
        { column: 'change_id', order: 'desc' },
      ])
      .limit(query.limit);
    return rows.map(rowToChange);
  }

  async claim(
    changeId: string,
    claim: ClaimRequest,
  ): Promise<Change | undefined> {
    const updated = await this.knex(CHANGES_TABLE)
      .where({ change_id: changeId, status: claim.expectedStatus })
      .update({
        status: 'deciding',
        claim_token: claim.token,
        claimed_at: claim.at,
        claimed_by: claim.by,
        claimed_action: claim.action,
        claim_reason: claim.reason,
        claim_previous_status: claim.expectedStatus,
      });
    if (updated !== 1) {
      return undefined;
    }
    return readChange(this.knex, changeId);
  }

  finish(
    changeId: string,
    token: string,
    result: FinishResult,
    audit?: (updated: Change) => NewAuditEntry,
  ): Promise<Change | undefined> {
    return this.knex.transaction(async trx => {
      const updated = await trx(CHANGES_TABLE)
        .where({ change_id: changeId, status: 'deciding', claim_token: token })
        .update({
          status: result.status,
          decided_by: result.decidedBy,
          decision_reason: result.reason,
          decided_at: result.decidedAt,
          failure_message: result.failureMessage ?? null,
          last_action: result.action,
          last_outcome: result.outcome,
          decision_count: trx.raw('decision_count + 1'),
          ...CLEARED_CLAIM,
        });
      if (updated !== 1) {
        return undefined;
      }
      const change = (await readChange(trx, changeId)) as Change;
      if (audit) {
        await appendAuditRow(trx, audit(change));
      }
      return change;
    });
  }

  async releaseStale(cutoff: string, now: string): Promise<Change[]> {
    const stale = await this.knex(CHANGES_TABLE)
      .where('status', 'deciding')
      .andWhere('claimed_at', '<', cutoff)
      .select('*');
    const released: Change[] = [];
    for (const row of stale) {
      const claimed = rowToChange(row);
      const result = await this.releaseOne(claimed, cutoff, now);
      if (result) {
        released.push(result);
      }
    }
    return released;
  }

  /** One conditional update plus its audit entry in one transaction (BR7.3). */
  private releaseOne(
    claimed: Change,
    cutoff: string,
    now: string,
  ): Promise<Change | undefined> {
    const isReject = claimed.claimedAction === 'reject';
    return this.knex.transaction(async trx => {
      const guard = trx(CHANGES_TABLE).where({
        change_id: claimed.changeId,
        status: 'deciding',
        claim_token: claimed.claimToken as string,
      });
      guard.andWhere('claimed_at', '<', cutoff);
      const updated = await guard.update(
        isReject
          ? {
              status: claimed.claimPreviousStatus ?? 'pending',
              ...CLEARED_CLAIM,
            }
          : {
              status: 'failed',
              failure_message: INTERRUPTED_MESSAGE,
              decision_count: trx.raw('decision_count + 1'),
              decided_by: claimed.claimedBy,
              decision_reason: claimed.claimReason,
              decided_at: now,
              last_action: claimed.claimedAction,
              last_outcome: 'failed',
              ...CLEARED_CLAIM,
            },
      );
      if (updated !== 1) {
        return undefined;
      }
      const change = (await readChange(trx, claimed.changeId)) as Change;
      await appendAuditRow(trx, {
        time: now,
        actor: claimed.claimedBy as string,
        action: claimed.claimedAction as NewAuditEntry['action'],
        service: change.service,
        target: change.target,
        outcome: 'failed',
        reason: claimed.claimReason,
        changeId: change.changeId,
        ...(isReject ? {} : { decisionNumber: change.decisionCount }),
      });
      return change;
    });
  }

  async findMissingLatestEntries(service: string): Promise<Change[]> {
    const rows = await this.knex(CHANGES_TABLE)
      .where(`${CHANGES_TABLE}.service`, service)
      .whereNotExists(function missingEntry() {
        this.select(1)
          .from(AUDIT_TABLE)
          .whereRaw(`${AUDIT_TABLE}.change_id = ${CHANGES_TABLE}.change_id`)
          .whereRaw(
            `${AUDIT_TABLE}.decision_number = ${CHANGES_TABLE}.decision_count`,
          );
      })
      .select(`${CHANGES_TABLE}.*`)
      .orderBy(`${CHANGES_TABLE}.change_id`, 'asc');
    return rows.map(rowToChange);
  }
}

export function createChangeStore(knex: Knex): ChangeStore {
  return new KnexChangeStore(knex);
}
