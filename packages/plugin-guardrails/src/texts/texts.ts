import type { Failure } from '../api/failures';
import type { ChangeStatus, Outcome, Role } from '../api/types';

/**
 * The string catalog: the single source of user-facing text. The first block
 * is the catalog of `interaction-spec.md`; the second block holds the texts
 * added in the Functional Design (D7, review R-06). Nothing outside this file
 * is shown to the person, except data (names, versions, causes, reasons).
 * `<name>` marks a placeholder.
 */
const CATALOG = {
  // ---- interaction-spec.md catalog ----
  'banner.proposed': 'Change proposed.',
  'banner.approved': 'Change approved and applied.',
  'banner.rejected': 'Change rejected.',
  'banner.applyFailed': 'Change approved but could not be applied.',
  'banner.retryApplied': 'Retry applied.',
  'banner.retryFailed': 'Retry failed again.',
  'error.unreachable': 'Guardrails server unreachable.',
  'error.submitFailed':
    'Could not reach the Guardrails server. Your reason is kept. Try again.',
  'error.notFound': 'This change no longer exists.',
  'error.reasonRequired': 'Enter a reason.',
  'refusal.alreadyDecided': 'This change was already decided.',
  'refusal.notFailed': 'Only a failed change can be retried.',
  'disabled.proposer':
    'You proposed this change, so someone else must decide it.',
  'disabled.auditor': 'Auditors can read but not change.',
  'disabled.unreachable': 'Guardrails server unreachable.',
  'empty.plan': 'No dependencies to upgrade.',
  'empty.ci': 'No failed CI runs.',
  'empty.open': 'No open changes.',
  'empty.audit': 'No audit entries yet.',
  'empty.auditFiltered': 'No entries match these filters.',
  'empty.card': 'Nothing to review.',
  'loading.section': 'Loading <section>.',
  'loading.card': 'Loading Guardrails.',
  'loading.change': 'Loading change...',
  'status.signedIn': 'Signed in as <name>.',
  'status.working': 'Working...',
  'status.counter': '<n> characters left',
  'error.dateRange': 'The end date must be on or after the start date.',
  'label.proposeChange': 'Propose change',
  'label.proposeChangeFor': 'Propose change for <dependency>',
  'label.proposeRerun': 'Propose re-run',
  'label.proposeRerunFor': 'Propose re-run for build <runNumber>',
  'label.approve': 'Approve',
  'label.reject': 'Reject',
  'label.retry': 'Retry',
  'label.back': 'Back',
  'label.view': 'View',
  'label.viewFor': 'View change: <title>',
  'label.openGuardrails': 'Open Guardrails',
  'label.clearFilters': 'Clear filters',
  'label.previous': 'Previous',
  'label.next': 'Next',
  'label.pageOf': 'Page <n> of <m>',
  'label.dismiss': 'Dismiss message',
  'label.switchUser': 'Switch demo user, signed in as <name>',
  'label.reason': 'Reason (required)',
  'text.whatItWillDo': 'What it will do',
  'text.proposedBy': 'Proposed by <name> at <time>',
  'text.decidedBy': 'Decided by <name> at <time>',
  'text.couldNotApply': 'Could not be applied: <message>',
  'section.plan': 'Dependency upgrade plan',
  'section.ci': 'CI failure triage',
  'section.open': 'Open changes',
  'section.audit': 'Audit log',
  'column.dependency': 'Dependency',
  'column.current': 'Current',
  'column.recommended': 'Recommended',
  'column.run': 'Run',
  'column.cause': 'Cause',
  'column.change': 'Change',
  'column.proposedBy': 'Proposed by',
  'column.status': 'Status',
  'column.action': 'Action',
  'column.time': 'Date/time',
  'column.actor': 'Actor',
  'column.auditAction': 'Action',
  'column.service': 'Service',
  'column.target': 'Target',
  'column.outcome': 'Outcome',
  'column.reason': 'Reason',
  'status.pending': 'Pending',
  'status.applied': 'Applied',
  'status.rejected': 'Rejected',
  'status.failed': 'Failed',
  'status.refused': 'Refused',
  'status.proposed': 'Proposed',

  // ---- additions (Functional Design D7, review R-06) ----
  'error.loadFailed': 'Could not load this section.',
  'error.generic': 'Something went wrong. Try again.',
  'error.unauthenticated': 'Your demo session ended. Choose a demo user.',
  'error.signedOut': 'Your session ended. Sign in again.',
  'refusal.notEligible': 'This can no longer be proposed.',
  'refusal.claimReleased': 'This change was interrupted. It has been reloaded.',
  'refusal.notFound': 'This change no longer exists.',
  'disabled.inProgress': 'This change is being decided.',
  'disabled.alreadyCurrent': 'Already at the recommended version.',
  'text.change': 'Change',
  'text.kindUpgrade': 'Dependency upgrade',
  'text.kindRerun': 'CI re-run',
  'text.noReason': '-',
  'text.dash': '-',
  'text.signedInAs': 'Signed in as: <name>',
  'text.userWithRole': '<name>, <role>',
  'loading.inline': 'Loading...',
  'label.retryLoad': 'Retry',
  'label.from': 'From',
  'label.to': 'To',
  'label.actor': 'Actor',
  'label.action': 'Action',
  'label.outcome': 'Outcome',
  'label.service': 'Service',
  'label.all': 'All',
  'label.filters': 'Audit log filters',
  'label.guardrails': 'Guardrails',
  'card.title': 'Guardrails',
  'card.upgrades': 'Upgrades available',
  'card.failedRuns': 'Failed CI runs',
  'card.open': 'Open changes',
  'title.view': 'Guardrails - <service>',
  'title.detail': '<title> - <service>',
  'title.detailLoading': 'Change - <service>',
  'action.propose': 'Propose',
  'action.approve': 'Approve',
  'action.reject': 'Reject',
  'action.retry': 'Retry',
  'role.service-owner': 'Service owner',
  'role.platform-engineer': 'Platform engineer',
  'role.auditor': 'Auditor',
  'label.demoUsers': 'Demo users',
  'label.main': 'Guardrails',
} as const;

export type TextKey = keyof typeof CATALOG;

export const ALL_KEYS = Object.keys(CATALOG) as TextKey[];

export type Vars = Record<string, string | number>;

/** Looks up a catalog text and fills its placeholders. A missing key throws. */
export function t(key: TextKey, vars: Vars = {}): string {
  const text = (CATALOG as Record<string, string>)[key];
  if (text === undefined) {
    throw new Error(`Missing text key: ${String(key)}`);
  }
  return text.replace(/<(\w+)>/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * The text for an allowed-action reason from the backend. NOT_PENDING and
 * NOT_FAILED are never shown (D11): the status already decided whether the
 * action appears. An unknown reason gets the generic text.
 */
export function reasonKey(reason: string): TextKey | undefined {
  switch (reason) {
    case 'SERVER_UNREACHABLE':
      return 'disabled.unreachable';
    case 'AUDITOR_READ_ONLY':
      return 'disabled.auditor';
    case 'PROPOSER_CANNOT_DECIDE':
      return 'disabled.proposer';
    case 'IN_PROGRESS':
      return 'disabled.inProgress';
    case 'ALREADY_CURRENT':
      return 'disabled.alreadyCurrent';
    case 'NOT_PENDING':
    case 'NOT_FAILED':
      return undefined;
    default:
      return 'error.generic';
  }
}

/** The text for a failed call, by where it happened (functional-spec table). */
export function failureKey(
  failure: Failure,
  where: 'read' | 'write',
  canSwitch = true,
): TextKey {
  switch (failure.kind) {
    case 'server-unreachable':
      return 'error.unreachable';
    case 'unauthenticated':
      // Asking to choose a demo user only makes sense when there is a switch.
      return canSwitch ? 'error.unauthenticated' : 'error.signedOut';
    case 'no-answer':
      return where === 'write' ? 'error.submitFailed' : 'error.loadFailed';
    case 'unknown':
      return where === 'write' ? 'error.generic' : 'error.loadFailed';
    case 'api':
      switch (failure.code) {
        case 'EMPTY_REASON':
          return 'error.reasonRequired';
        case 'AUDITOR_READ_ONLY':
          return 'disabled.auditor';
        case 'SELF_DECISION':
          return 'disabled.proposer';
        case 'NOT_FOUND':
          return 'error.notFound';
        case 'ALREADY_DECIDED':
          return 'refusal.alreadyDecided';
        case 'NOT_FAILED':
          return 'refusal.notFailed';
        case 'NOT_ELIGIBLE':
          return 'refusal.notEligible';
        case 'CLAIM_RELEASED':
          return 'refusal.claimReleased';
        default:
          return where === 'write' ? 'error.generic' : 'error.loadFailed';
      }
    default:
      return where === 'write' ? 'error.generic' : 'error.loadFailed';
  }
}

export function roleLabelKey(role: Role): TextKey {
  return `role.${role}` as TextKey;
}

export function statusKey(status: ChangeStatus | Outcome): TextKey {
  return `status.${status}` as TextKey;
}
