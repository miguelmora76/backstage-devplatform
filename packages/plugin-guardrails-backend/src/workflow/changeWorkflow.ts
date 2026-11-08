import type { LoggerService } from '@backstage/backend-plugin-api';
import { isoNow, type Clock } from '../clock';
import { GuardrailsError } from '../errors';
import type { ChangeStatusFilter } from '../http/inputSchemas';
import { findDemoUser, type DemoUser } from '../identity/demoUsers';
import type { IdGenerator } from '../ids';
import {
  actionRefusal,
  allowedActionForPropose,
  allowedActionsForChange,
  type AllowedAction,
} from '../rules/allowedActions';
import {
  GuardrailsCallError,
  type GuardrailsClient,
} from '../server/guardrailsClient';
import type { ServerHealth } from '../server/serverHealth';
import type {
  AuditAction,
  AuditPage,
  AuditQuery,
  AuditStore,
  Change,
  ChangeKind,
  ChangeStatus,
  ChangeStore,
  DecisionAction,
  DecisionOutcome,
  NewAuditEntry,
} from '../store/types';
import type { Recovery } from './recovery';

const MAX_CHANGES = 200;

export interface ChangeView {
  changeId: string;
  kind: ChangeKind;
  service: string;
  target: string;
  summary: string;
  proposedBy: DemoUser;
  /** Never `deciding`: a change being decided shows its previous status (BR7.5). */
  status: Exclude<ChangeStatus, 'deciding'>;
  decidedBy?: DemoUser;
  decisionReason?: string;
  failureMessage?: string;
  proposedAt: string;
  decidedAt?: string;
  allowedActions: AllowedAction[];
}

export interface PlanView {
  service: string;
  items: Array<{
    dependencyKey: string;
    name: string;
    currentVersion: string;
    recommendedVersion: string;
    allowedActions: AllowedAction[];
  }>;
}

export interface CiRunView {
  service: string;
  items: Array<{
    runKey: string;
    runNumber: number;
    status: string;
    cause: string;
    allowedActions: AllowedAction[];
  }>;
}

export interface AuditEntryView {
  entryId: string;
  time: string;
  actor: DemoUser;
  action: AuditAction;
  service: string;
  target: string;
  outcome: NewAuditEntry['outcome'];
  reason?: string;
  changeId?: string;
}

export interface AuditPageView {
  items: AuditEntryView[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ChangeWorkflowDeps {
  changes: ChangeStore;
  audit: AuditStore;
  client: GuardrailsClient;
  health: ServerHealth;
  recovery: Recovery;
  clock: Clock;
  ids: IdGenerator;
  logger: LoggerService;
}

export interface ChangeWorkflow {
  propose(
    actor: DemoUser,
    service: string,
    input: { kind: ChangeKind; target: string },
  ): Promise<ChangeView>;
  decide(
    actor: DemoUser,
    action: DecisionAction,
    changeId: string,
    reason: string,
  ): Promise<ChangeView>;
  listChanges(
    actor: DemoUser,
    service: string,
    status: ChangeStatusFilter,
  ): Promise<ChangeView[]>;
  getChange(actor: DemoUser, changeId: string): Promise<ChangeView>;
  listPlan(actor: DemoUser, service: string): Promise<PlanView>;
  listCiRuns(actor: DemoUser, service: string): Promise<CiRunView>;
  readAudit(service: string, query: AuditQuery): Promise<AuditPageView>;
}

/** Stored ids only name demo users; an unknown id gets the least privilege. */
function userView(userId: string): DemoUser {
  return findDemoUser(userId) ?? { userId, name: userId, role: 'auditor' };
}

function failureMessageFor(error: GuardrailsCallError): string {
  if (error.kind === 'timeout') {
    return 'The guardrails server did not answer in time.';
  }
  if (error.kind === 'tool-error' && error.code && error.code !== 'UNKNOWN') {
    return `The guardrails server reported an error (${error.code}).`;
  }
  if (error.kind === 'unavailable') {
    return 'The guardrails server could not be reached.';
  }
  return 'The guardrails server reported an error.';
}

/**
 * The stored statuses a filter reads. A change being decided is read too, so
 * it shows with its previous status instead of vanishing (BR7.5).
 */
function statusesToRead(filter: ChangeStatusFilter): ChangeStatus[] {
  if (filter === 'open') {
    return ['pending', 'failed', 'deciding'];
  }
  if (filter === 'pending' || filter === 'failed') {
    return [filter, 'deciding'];
  }
  return [filter];
}

interface DecisionResult {
  status: 'applied' | 'rejected' | 'failed';
  outcome: DecisionOutcome;
  failureMessage?: string;
}

const REJECTED: DecisionResult = { status: 'rejected', outcome: 'rejected' };

const SUCCESS_RESULTS: Record<ChangeKind, string[]> = {
  upgrade: ['applied', 'already-current'],
  rerun: ['rerun-started'],
};

class DefaultChangeWorkflow implements ChangeWorkflow {
  constructor(private readonly d: ChangeWorkflowDeps) {}

  // ---- writes -------------------------------------------------------------

  async propose(
    actor: DemoUser,
    service: string,
    input: { kind: ChangeKind; target: string },
  ): Promise<ChangeView> {
    if (actionRefusal(actor, 'propose')) {
      await this.d.audit.append({
        time: isoNow(this.d.clock),
        actor: actor.userId,
        action: 'propose',
        service,
        target: input.target,
        outcome: 'refused',
      });
      throw new GuardrailsError('AUDITOR_READ_ONLY');
    }
    await this.requireReachable();
    const summary = await this.checkTarget(service, input);

    const now = isoNow(this.d.clock);
    const changeId = this.d.ids.changeId();
    const change = await this.d.changes.insert(
      {
        changeId,
        kind: input.kind,
        service,
        target: input.target,
        summary,
        proposedBy: actor.userId,
        proposedAt: now,
      },
      {
        time: now,
        actor: actor.userId,
        action: 'propose',
        service,
        target: input.target,
        outcome: 'proposed',
        changeId,
        decisionNumber: 0,
      },
    );
    return this.toView(actor, change, true);
  }

  async decide(
    actor: DemoUser,
    action: DecisionAction,
    changeId: string,
    reason: string,
  ): Promise<ChangeView> {
    await this.d.recovery.releaseStale();
    const change = await this.d.changes.get(changeId);
    if (!change) {
      throw new GuardrailsError('NOT_FOUND');
    }
    if (reason.trim() === '') {
      throw new GuardrailsError('EMPTY_REASON');
    }
    const refusal = actionRefusal(actor, action, change);
    if (refusal) {
      await this.recordRefused(actor, action, change, reason);
      throw new GuardrailsError(
        refusal === 'AUDITOR_READ_ONLY' ? 'AUDITOR_READ_ONLY' : 'SELF_DECISION',
      );
    }
    await this.requireReachable();

    // Step 0: a new decision can never hide an earlier one.
    await this.d.recovery.repairChange(change);

    const token = this.d.ids.token();
    const claimed = await this.d.changes.claim(changeId, {
      expectedStatus: action === 'retry' ? 'failed' : 'pending',
      token,
      at: isoNow(this.d.clock),
      by: actor.userId,
      action,
      reason,
    });
    if (!claimed) {
      await this.recordRefused(actor, action, change, reason);
      throw new GuardrailsError(
        action === 'retry' ? 'NOT_FAILED' : 'ALREADY_DECIDED',
      );
    }

    // Approve, reject and retry share this path: only the server step differs.
    const result: DecisionResult =
      action === 'reject' ? REJECTED : await this.applyOnServer(claimed);
    return this.finishDecision(actor, action, claimed, token, reason, result);
  }

  /** Final write and audit entry in one transaction, bound to the caller's claim (BR3.4 steps 3 and 4). */
  private async finishDecision(
    actor: DemoUser,
    action: DecisionAction,
    claimed: Change,
    token: string,
    reason: string,
    result: DecisionResult,
  ): Promise<ChangeView> {
    const decidedAt = isoNow(this.d.clock);
    const done = await this.d.changes.finish(
      claimed.changeId,
      token,
      {
        status: result.status,
        decidedBy: actor.userId,
        reason,
        decidedAt,
        action,
        outcome: result.outcome,
        failureMessage: result.failureMessage,
      },
      updated => ({
        time: decidedAt,
        actor: actor.userId,
        action,
        service: updated.service,
        target: updated.target,
        outcome: result.outcome,
        reason,
        changeId: updated.changeId,
        decisionNumber: updated.decisionCount,
      }),
    );
    if (!done) {
      // The claim was released meanwhile; the release wrote its own entry.
      throw new GuardrailsError('CLAIM_RELEASED');
    }
    return this.toView(actor, done, true);
  }

  // ---- reads --------------------------------------------------------------

  async listChanges(
    actor: DemoUser,
    service: string,
    status: ChangeStatusFilter,
  ): Promise<ChangeView[]> {
    await this.d.recovery.releaseStale();
    await this.d.recovery.repairService(service);
    const reachable = await this.d.health.isReachable();
    const rows = await this.d.changes.list(service, {
      statuses: statusesToRead(status),
      limit: MAX_CHANGES,
    });
    return rows
      .map(change => this.toView(actor, change, reachable))
      .filter(view => status === 'open' || view.status === status);
  }

  async getChange(actor: DemoUser, changeId: string): Promise<ChangeView> {
    await this.d.recovery.releaseStale();
    const change = await this.d.changes.get(changeId);
    if (!change) {
      throw new GuardrailsError('NOT_FOUND');
    }
    await this.d.recovery.repairService(change.service);
    const reachable = await this.d.health.isReachable();
    return this.toView(actor, change, reachable);
  }

  async listPlan(actor: DemoUser, service: string): Promise<PlanView> {
    await this.requireReachable();
    const dependencies = await this.readServer(() =>
      this.d.client.listUpgradePlan(service),
    );
    return {
      service,
      items: dependencies.map(dep => ({
        ...dep,
        allowedActions: [
          allowedActionForPropose({
            actor,
            reachable: true,
            alreadyCurrent: dep.currentVersion === dep.recommendedVersion,
          }),
        ],
      })),
    };
  }

  async listCiRuns(actor: DemoUser, service: string): Promise<CiRunView> {
    await this.requireReachable();
    const runs = await this.readServer(() =>
      this.d.client.listFailedCiRuns(service),
    );
    return {
      service,
      items: runs.map(run => ({
        ...run,
        allowedActions: [allowedActionForPropose({ actor, reachable: true })],
      })),
    };
  }

  async readAudit(service: string, query: AuditQuery): Promise<AuditPageView> {
    await this.d.recovery.releaseStale();
    await this.d.recovery.repairService(service);
    const page: AuditPage = await this.d.audit.read(service, query);
    return {
      ...page,
      items: page.items.map(entry => ({
        entryId: entry.entryId,
        time: entry.time,
        actor: userView(entry.actor),
        action: entry.action,
        service: entry.service,
        target: entry.target,
        outcome: entry.outcome,
        ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
        ...(entry.changeId !== undefined ? { changeId: entry.changeId } : {}),
      })),
    };
  }

  // ---- helpers ------------------------------------------------------------

  private async requireReachable(): Promise<void> {
    if (!(await this.d.health.isReachable())) {
      throw new GuardrailsError('SERVER_UNREACHABLE');
    }
  }

  /** A read from the server: an unknown service is NOT_FOUND, anything else is an outage (BR6.1). */
  private async readServer<T>(read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (error) {
      if (
        error instanceof GuardrailsCallError &&
        error.kind === 'tool-error' &&
        error.code === 'UNKNOWN_SERVICE'
      ) {
        throw new GuardrailsError('NOT_FOUND');
      }
      if (error instanceof GuardrailsCallError) {
        throw new GuardrailsError('SERVER_UNREACHABLE');
      }
      throw error;
    }
  }

  /** Checks the target against the server (BR2.3) and returns the summary written once (BR2.6). */
  private async checkTarget(
    service: string,
    input: { kind: ChangeKind; target: string },
  ): Promise<string> {
    if (input.kind === 'upgrade') {
      const plan = await this.readServer(() =>
        this.d.client.listUpgradePlan(service),
      );
      const dep = plan.find(d => d.dependencyKey === input.target);
      if (!dep) throw new GuardrailsError('NOT_FOUND');
      if (dep.currentVersion === dep.recommendedVersion) {
        throw new GuardrailsError('NOT_ELIGIBLE');
      }
      return `Upgrade ${dep.name} from ${dep.currentVersion} to ${dep.recommendedVersion}`;
    }
    const runs = await this.readServer(() =>
      this.d.client.listFailedCiRuns(service),
    );
    // The server lists only failed runs: a run that is missing is no longer failed.
    const run = runs.find(r => r.runKey === input.target);
    if (!run || run.status !== 'failed') {
      throw new GuardrailsError('NOT_ELIGIBLE');
    }
    return `Re-run CI run #${run.runNumber} (${run.cause})`;
  }

  /** The write call: success means applied; any call error means failed, never repeated (BR3.7-BR3.9). */
  private async applyOnServer(change: Change): Promise<DecisionResult> {
    try {
      const answer =
        change.kind === 'upgrade'
          ? await this.d.client.applyDependencyUpgrade(
              change.service,
              change.target,
            )
          : await this.d.client.rerunCiJob(change.service, change.target);
      if (SUCCESS_RESULTS[change.kind].includes(answer.result)) {
        return { status: 'applied', outcome: 'applied' };
      }
      return {
        status: 'failed',
        outcome: 'failed',
        failureMessage: 'The guardrails server reported an error.',
      };
    } catch (error) {
      if (error instanceof GuardrailsCallError) {
        return {
          status: 'failed',
          outcome: 'failed',
          failureMessage: failureMessageFor(error),
        };
      }
      // Unexpected: the claim stays and is released after 30 seconds (NFR5.9).
      throw error;
    }
  }

  private recordRefused(
    actor: DemoUser,
    action: DecisionAction,
    change: Change,
    reason: string,
  ): Promise<void> {
    return this.d.audit.append({
      time: isoNow(this.d.clock),
      actor: actor.userId,
      action,
      service: change.service,
      target: change.target,
      outcome: 'refused',
      reason,
      changeId: change.changeId,
    });
  }

  private toView(
    actor: DemoUser,
    change: Change,
    reachable: boolean,
  ): ChangeView {
    const status =
      change.status === 'deciding'
        ? (change.claimPreviousStatus ?? 'pending')
        : change.status;
    return {
      changeId: change.changeId,
      kind: change.kind,
      service: change.service,
      target: change.target,
      summary: change.summary,
      proposedBy: userView(change.proposedBy),
      status,
      ...(change.decidedBy ? { decidedBy: userView(change.decidedBy) } : {}),
      ...(change.decisionReason !== undefined
        ? { decisionReason: change.decisionReason }
        : {}),
      ...(change.failureMessage !== undefined
        ? { failureMessage: change.failureMessage }
        : {}),
      proposedAt: change.proposedAt,
      ...(change.decidedAt ? { decidedAt: change.decidedAt } : {}),
      allowedActions: allowedActionsForChange({ actor, change, reachable }),
    };
  }
}

export function createChangeWorkflow(deps: ChangeWorkflowDeps): ChangeWorkflow {
  return new DefaultChangeWorkflow(deps);
}
