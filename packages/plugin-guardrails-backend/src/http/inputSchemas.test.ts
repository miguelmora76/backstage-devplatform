import {
  parseAuditQuery,
  parseChangeId,
  parseChangesQuery,
  parseDecisionBody,
  parseProposeBody,
  parseService,
} from './inputSchemas';

/** The error a call throws; fails the test when it does not throw. */
function refusalOf(call: () => unknown): Error {
  let caught: unknown;
  try {
    call();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  return caught as Error;
}

const invalid = (field?: string) =>
  expect.objectContaining({
    code: 'INVALID_INPUT',
    message: expect.stringContaining(field ?? ''),
  });

describe('propose body', () => {
  it('accepts a known kind and a target and removes unknown fields', () => {
    expect(
      parseProposeBody({
        kind: 'upgrade',
        target: 'dep-1',
        actor: 'alex',
        role: 'auditor',
        extra: { a: 1 },
      }),
    ).toEqual({ kind: 'upgrade', target: 'dep-1' });
  });

  it('refuses an unknown kind, a missing or empty target, and a non-object body', () => {
    expect(() => parseProposeBody({ kind: 'delete', target: 'x' })).toThrow(
      invalid('kind'),
    );
    expect(() => parseProposeBody({ kind: 'rerun' })).toThrow(
      invalid('target'),
    );
    expect(() => parseProposeBody({ kind: 'rerun', target: '' })).toThrow(
      invalid('target'),
    );
    expect(() => parseProposeBody(undefined)).toThrow(invalid());
    expect(() => parseProposeBody('upgrade')).toThrow(invalid());
  });

  it('accepts hostile text as a plain target and never echoes it in the message', () => {
    const hostile = `<script>alert(1)</script>'; drop table changes; --`;
    expect(parseProposeBody({ kind: 'upgrade', target: hostile }).target).toBe(
      hostile,
    );
    const refusal = refusalOf(() =>
      parseProposeBody({ kind: hostile, target: 'x' }),
    );
    expect(refusal.message).not.toContain('script');
    expect(refusal.message).toContain('kind');
  });
});

describe('decision body', () => {
  it('keeps the reason exactly as submitted, without trimming', () => {
    expect(
      parseDecisionBody({ reason: '  Looks fine  \n', actor: 'x' }),
    ).toEqual({
      reason: '  Looks fine  \n',
    });
  });

  it('accepts an empty or whitespace reason here: EMPTY_REASON is a later step', () => {
    expect(parseDecisionBody({ reason: '   ' }).reason).toBe('   ');
    expect(parseDecisionBody({ reason: '' }).reason).toBe('');
  });

  it('accepts exactly 2,000 characters and refuses 2,001', () => {
    expect(parseDecisionBody({ reason: 'a'.repeat(2000) }).reason).toHaveLength(
      2000,
    );
    expect(() => parseDecisionBody({ reason: 'a'.repeat(2001) })).toThrow(
      invalid('reason'),
    );
  });

  it('refuses a missing or non-text reason', () => {
    expect(() => parseDecisionBody({})).toThrow(invalid('reason'));
    expect(() => parseDecisionBody({ reason: 5 })).toThrow(invalid('reason'));
    expect(() => parseDecisionBody(null)).toThrow(invalid());
  });

  it('accepts markup and statement characters as plain text', () => {
    const hostile = `<img src=x onerror=alert(1)> ' OR 1=1 --`;
    expect(parseDecisionBody({ reason: hostile }).reason).toBe(hostile);
  });
});

describe('changes query', () => {
  it('defaults to open and accepts the known statuses', () => {
    expect(parseChangesQuery({})).toEqual({ status: 'open' });
    for (const status of ['open', 'pending', 'applied', 'rejected', 'failed']) {
      expect(parseChangesQuery({ status })).toEqual({ status });
    }
  });

  it('refuses deciding, unknown values and repeated parameters', () => {
    expect(() => parseChangesQuery({ status: 'deciding' })).toThrow(
      invalid('status'),
    );
    expect(() => parseChangesQuery({ status: 'x' })).toThrow(invalid('status'));
    expect(() => parseChangesQuery({ status: ['open', 'failed'] })).toThrow(
      invalid('status'),
    );
  });
});

describe('audit query', () => {
  it('passes valid filters through, with dates as ISO timestamps in UTC', () => {
    expect(
      parseAuditQuery({
        from: '2026-01-01T10:00:00+02:00',
        to: '2026-01-02T00:00:00.000Z',
        actor: 'priya',
        action: 'approve',
        outcome: 'applied',
        page: '2',
        pageSize: '50',
        ignored: 'x',
      }),
    ).toEqual({
      from: '2026-01-01T08:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      actor: 'priya',
      action: 'approve',
      outcome: 'applied',
      page: 2,
      pageSize: 50,
    });
  });

  it('gives an empty query when nothing is set', () => {
    expect(parseAuditQuery({})).toEqual({});
  });

  it('refuses page ranges instead of clamping them', () => {
    for (const bad of [
      { page: '0' },
      { page: '-1' },
      { page: '1.5' },
      { page: 'abc' },
      { pageSize: '0' },
      { pageSize: '101' },
      { pageSize: '1000000' },
      { pageSize: 'x' },
    ]) {
      expect(() => parseAuditQuery(bad)).toThrow(invalid());
    }
    expect(parseAuditQuery({ page: '1', pageSize: '1' })).toEqual({
      page: 1,
      pageSize: 1,
    });
    expect(parseAuditQuery({ pageSize: '100' })).toEqual({ pageSize: 100 });
  });

  it('refuses bad dates, unknown actions and outcomes, and repeated parameters', () => {
    expect(() => parseAuditQuery({ from: 'yesterday' })).toThrow(
      invalid('from'),
    );
    expect(() => parseAuditQuery({ to: '2026-13-45T00:00:00Z' })).toThrow(
      invalid('to'),
    );
    expect(() => parseAuditQuery({ action: 'delete' })).toThrow(
      invalid('action'),
    );
    expect(() => parseAuditQuery({ outcome: 'ok' })).toThrow(
      invalid('outcome'),
    );
    expect(() => parseAuditQuery({ actor: ['a', 'b'] })).toThrow(
      invalid('actor'),
    );
  });

  it('accepts hostile text in the actor filter as plain text', () => {
    const hostile = `'; delete from audit_entries; --`;
    expect(parseAuditQuery({ actor: hostile })).toEqual({ actor: hostile });
  });
});

describe('path parameters', () => {
  it('accepts a non-empty name and refuses empty or very long ones', () => {
    expect(parseService('orders')).toBe('orders');
    expect(parseChangeId('chg-1')).toBe('chg-1');
    expect(() => parseService('')).toThrow(invalid('service'));
    expect(() => parseService('x'.repeat(201))).toThrow(invalid('service'));
    expect(() => parseChangeId('')).toThrow(invalid('changeId'));
    expect(() => parseChangeId(undefined)).toThrow(invalid('changeId'));
  });
});
