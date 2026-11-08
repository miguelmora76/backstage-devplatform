import type { LoggerService } from '@backstage/backend-plugin-api';
import { isoNow, type Clock } from '../clock';
import type {
  AuditStore,
  Change,
  ChangeStore,
  NewAuditEntry,
} from '../store/types';

export const CLAIM_RELEASE_MS = 30_000;

export interface Recovery {
  /** Releases every claim older than 30 seconds (BR7.3). */
  releaseStale(): Promise<void>;
  /** Rebuilds missing entries of a service; a failure is logged and the caller carries on (BR7.4). */
  repairService(service: string): Promise<void>;
  /** Rebuilds the missing latest entry of one change; a failure is raised (decision step 0). */
  repairChange(change: Change): Promise<void>;
}

export interface RecoveryOptions {
  changes: ChangeStore;
  audit: AuditStore;
  clock: Clock;
  logger: LoggerService;
}

/**
 * The audit entry the change record says should exist for its latest proposal
 * or decision (BR7.4). Decision number 0 is the proposal.
 */
export function entryFromChange(change: Change): NewAuditEntry {
  if (change.decisionCount === 0) {
    return {
      time: change.proposedAt,
      actor: change.proposedBy,
      action: 'propose',
      service: change.service,
      target: change.target,
      outcome: 'proposed',
      changeId: change.changeId,
      decisionNumber: 0,
    };
  }
  return {
    time: change.decidedAt as string,
    actor: change.decidedBy as string,
    action: change.lastAction as NewAuditEntry['action'],
    service: change.service,
    target: change.target,
    outcome: change.lastOutcome as NewAuditEntry['outcome'],
    reason: change.decisionReason,
    changeId: change.changeId,
    decisionNumber: change.decisionCount,
  };
}

export function createRecovery(options: RecoveryOptions): Recovery {
  const { changes, audit, clock, logger } = options;

  async function rebuild(change: Change): Promise<void> {
    await audit.append(entryFromChange(change));
    // The change id only: never a reason or any other submitted text (NFR5.8).
    logger.info('Rebuilt a missing audit entry', {
      changeId: change.changeId,
    });
  }

  return {
    async releaseStale() {
      const now = clock().getTime();
      const released = await changes.releaseStale(
        new Date(now - CLAIM_RELEASE_MS).toISOString(),
        isoNow(clock),
      );
      for (const change of released) {
        logger.info('Released a stale claim', { changeId: change.changeId });
      }
    },

    async repairService(service) {
      try {
        for (const change of await changes.findMissingLatestEntries(service)) {
          await rebuild(change);
        }
      } catch (error) {
        logger.error(
          'Audit repair failed; it is tried again at the next read',
          {
            errorClass:
              error instanceof Error ? error.constructor.name : 'unknown',
          },
        );
      }
    },

    async repairChange(change) {
      const keys = await audit.findDecisionKeys([change.changeId]);
      if (!keys.has(`${change.changeId}:${change.decisionCount}`)) {
        await rebuild(change);
      }
    },
  };
}
