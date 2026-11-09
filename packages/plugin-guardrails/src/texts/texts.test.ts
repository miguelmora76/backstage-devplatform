import {
  ALL_KEYS,
  failureKey,
  reasonKey,
  roleLabelKey,
  statusKey,
  t,
} from './texts';

describe('string catalog (D7)', () => {
  it('has the exact catalog wording for the texts the mockups quote', () => {
    expect(t('banner.proposed')).toBe('Change proposed.');
    expect(t('banner.applyFailed')).toBe(
      'Change approved but could not be applied.',
    );
    expect(t('error.submitFailed')).toBe(
      'Could not reach the Guardrails server. Your reason is kept. Try again.',
    );
    expect(t('disabled.proposer')).toBe(
      'You proposed this change, so someone else must decide it.',
    );
    expect(t('label.reason')).toBe('Reason (required)');
    expect(t('status.working')).toBe('Working...');
  });

  it('adds the texts the catalog lacked (D7)', () => {
    expect(t('error.loadFailed')).toBe('Could not load this section.');
    expect(t('error.generic')).toBe('Something went wrong. Try again.');
    expect(t('error.unauthenticated')).toBe(
      'Your demo session ended. Choose a demo user.',
    );
    expect(t('refusal.notEligible')).toBe('This can no longer be proposed.');
    expect(t('error.signedOut')).toBe('Your session ended. Sign in again.');
    expect(t('text.dash')).toBe('-');
    expect(t('refusal.claimReleased')).toBe(
      'This change was interrupted. It has been reloaded.',
    );
    expect(t('disabled.inProgress')).toBe('This change is being decided.');
    expect(t('disabled.alreadyCurrent')).toBe(
      'Already at the recommended version.',
    );
    expect(t('text.change')).toBe('Change');
    expect(t('text.kindUpgrade')).toBe('Dependency upgrade');
    expect(t('text.kindRerun')).toBe('CI re-run');
  });

  it('fills <placeholders> and leaves no placeholder behind', () => {
    expect(t('label.proposeChangeFor', { dependency: 'lib-a' })).toBe(
      'Propose change for lib-a',
    );
    expect(t('label.pageOf', { n: 2, m: 3 })).toBe('Page 2 of 3');
    expect(t('status.signedIn', { name: 'Sam' })).toBe('Signed in as Sam.');
    expect(t('status.counter', { n: 100 })).toBe('100 characters left');
    expect(
      t('text.couldNotApply', { message: 'Runner pool unavailable' }),
    ).toBe('Could not be applied: Runner pool unavailable');
  });

  it('fails when a key is missing from the catalog', () => {
    expect(() => t('no.such.key' as never)).toThrow(/no.such.key/);
  });

  it('has a non-empty text for every key, and no key repeats a placeholder-only text', () => {
    for (const key of ALL_KEYS) {
      expect(t(key, {}).length).toBeGreaterThan(0);
    }
  });

  it('covers filter labels, role labels, column names and the "-" for no reason', () => {
    expect(t('label.from')).toBe('From');
    expect(t('label.actor')).toBe('Actor');
    expect(t('label.service')).toBe('Service');
    expect(t('text.noReason')).toBe('-');
    expect(t(roleLabelKey('auditor'))).toBe('Auditor');
    expect(t(roleLabelKey('service-owner'))).toBe('Service owner');
    expect(t(statusKey('failed'))).toBe('Failed');
    expect(t(statusKey('proposed'))).toBe('Proposed');
  });
});

describe('reason to text (functional-spec: Allowed-Action Reasons to Texts)', () => {
  it.each([
    ['SERVER_UNREACHABLE', 'disabled.unreachable'],
    ['AUDITOR_READ_ONLY', 'disabled.auditor'],
    ['PROPOSER_CANNOT_DECIDE', 'disabled.proposer'],
    ['IN_PROGRESS', 'disabled.inProgress'],
    ['ALREADY_CURRENT', 'disabled.alreadyCurrent'],
  ])('%s shows %s', (reason, key) => {
    expect(reasonKey(reason)).toBe(key);
  });

  it('never shows NOT_PENDING or NOT_FAILED', () => {
    expect(reasonKey('NOT_PENDING')).toBeUndefined();
    expect(reasonKey('NOT_FAILED')).toBeUndefined();
  });

  it('turns an unknown reason into the generic text', () => {
    expect(reasonKey('SOMETHING_NEW')).toBe('error.generic');
  });
});

describe('failure to text (functional-spec: Error Answers to Texts)', () => {
  it.each([
    [{ kind: 'server-unreachable' }, 'write', 'error.unreachable'],
    [{ kind: 'no-answer' }, 'write', 'error.submitFailed'],
    [{ kind: 'no-answer' }, 'read', 'error.loadFailed'],
    [{ kind: 'unauthenticated' }, 'read', 'error.unauthenticated'],
    [{ kind: 'unauthenticated' }, 'write', 'error.unauthenticated'],
    [
      { kind: 'api', code: 'EMPTY_REASON', status: 400 },
      'write',
      'error.reasonRequired',
    ],
    [
      { kind: 'api', code: 'INVALID_INPUT', status: 400 },
      'write',
      'error.generic',
    ],
    [
      { kind: 'api', code: 'INTERNAL_ERROR', status: 500 },
      'write',
      'error.generic',
    ],
    [
      { kind: 'api', code: 'AUDITOR_READ_ONLY', status: 403 },
      'write',
      'disabled.auditor',
    ],
    [
      { kind: 'api', code: 'SELF_DECISION', status: 403 },
      'write',
      'disabled.proposer',
    ],
    [
      { kind: 'api', code: 'NOT_FOUND', status: 404 },
      'write',
      'error.notFound',
    ],
    [{ kind: 'api', code: 'NOT_FOUND', status: 404 }, 'read', 'error.notFound'],
    [
      { kind: 'api', code: 'ALREADY_DECIDED', status: 409 },
      'write',
      'refusal.alreadyDecided',
    ],
    [
      { kind: 'api', code: 'NOT_FAILED', status: 409 },
      'write',
      'refusal.notFailed',
    ],
    [
      { kind: 'api', code: 'NOT_ELIGIBLE', status: 409 },
      'write',
      'refusal.notEligible',
    ],
    [
      { kind: 'api', code: 'CLAIM_RELEASED', status: 409 },
      'write',
      'refusal.claimReleased',
    ],
    [
      { kind: 'api', code: 'INTERNAL_ERROR', status: 500 },
      'read',
      'error.loadFailed',
    ],
    [{ kind: 'unknown', status: 500 }, 'write', 'error.generic'],
    [{ kind: 'unknown', status: 500 }, 'read', 'error.loadFailed'],
  ] as const)('%j on a %s shows %s', (failure, where, key) => {
    expect(failureKey(failure as never, where)).toBe(key);
  });
});

describe('a 401 when there is nobody to switch to', () => {
  it('asks to choose a demo user only when the switch exists', () => {
    expect(failureKey({ kind: 'unauthenticated' }, 'read', true)).toBe(
      'error.unauthenticated',
    );
    expect(failureKey({ kind: 'unauthenticated' }, 'write', false)).toBe(
      'error.signedOut',
    );
    expect(failureKey({ kind: 'unauthenticated' }, 'read')).toBe(
      'error.unauthenticated',
    );
  });
});
