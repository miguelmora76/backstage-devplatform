import type { Knex } from 'knex';
import { AUDIT_TABLE } from '../database/tables';
import { type Db, rowToEntry } from './rows';
import type { AuditPage, AuditQuery, AuditStore, NewAuditEntry } from './types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const KEY_CHUNK = 500;

/**
 * Appends one row. The same (changeId, decisionNumber) twice has no effect;
 * rows without a decision number never conflict. Bound values only (NFR5.7).
 */
export async function appendAuditRow(
  db: Db,
  entry: NewAuditEntry,
): Promise<void> {
  await db(AUDIT_TABLE)
    .insert({
      time: entry.time,
      actor: entry.actor,
      action: entry.action,
      service: entry.service,
      target: entry.target,
      outcome: entry.outcome,
      reason: entry.reason ?? null,
      change_id: entry.changeId ?? null,
      decision_number: entry.decisionNumber ?? null,
    })
    .onConflict(['change_id', 'decision_number'])
    .ignore();
}

class KnexAuditStore implements AuditStore {
  constructor(private readonly knex: Knex) {}

  async append(entry: NewAuditEntry): Promise<void> {
    await appendAuditRow(this.knex, entry);
  }

  async read(service: string, query: AuditQuery): Promise<AuditPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(page) || page < 1) {
      throw new RangeError('page must be 1 or more');
    }
    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      throw new RangeError(`pageSize must be 1 to ${MAX_PAGE_SIZE}`);
    }

    const base = this.knex(AUDIT_TABLE).where('service', service);
    if (query.from) base.andWhere('time', '>=', query.from);
    if (query.to) base.andWhere('time', '<=', query.to);
    if (query.actor) base.andWhere('actor', query.actor);
    if (query.action) base.andWhere('action', query.action);
    if (query.outcome) base.andWhere('outcome', query.outcome);

    const [{ count }] = await base.clone().count({ count: '*' });
    const rows = await base
      .clone()
      .select('*')
      .orderBy([
        { column: 'time', order: 'desc' },
        { column: 'entry_id', order: 'desc' },
      ])
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items: rows.map(rowToEntry),
      page,
      pageSize,
      total: Number(count),
    };
  }

  async findDecisionKeys(changeIds: string[]): Promise<Set<string>> {
    const keys = new Set<string>();
    for (let i = 0; i < changeIds.length; i += KEY_CHUNK) {
      const rows = await this.knex(AUDIT_TABLE)
        .whereIn('change_id', changeIds.slice(i, i + KEY_CHUNK))
        .whereNotNull('decision_number')
        .select('change_id', 'decision_number');
      for (const row of rows) {
        keys.add(`${row.change_id}:${Number(row.decision_number)}`);
      }
    }
    return keys;
  }
}

export function createAuditStore(knex: Knex): AuditStore {
  return new KnexAuditStore(knex);
}
