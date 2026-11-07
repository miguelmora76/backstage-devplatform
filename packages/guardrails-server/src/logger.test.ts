import { createLogger } from './logger';

function capture() {
  const lines: string[] = [];
  const logger = createLogger({
    write: line => lines.push(line),
    now: () => new Date('2026-11-06T10:20:30.456Z'),
  });
  return { lines, logger };
}

describe('createLogger', () => {
  it('writes the start line with seed, failure mode and port (NFR1.6)', () => {
    const { lines, logger } = capture();
    logger.start({ seed: 77, failureMode: 'on', port: 7007 });
    expect(lines).toEqual([
      '2026-11-06T10:20:30.456Z start seed=77 failure=on port=7007',
    ]);
  });

  it('writes one call line of the fixed shape', () => {
    const { lines, logger } = capture();
    logger.call({
      tool: 'list_upgrade_plan',
      service: 'checkout-api',
      result: 'ok',
      ms: 3.4,
    });
    logger.call({
      tool: 'rerun_ci_job',
      service: 'checkout-api',
      result: 'UNKNOWN_RUN',
      ms: 0,
    });
    expect(lines).toEqual([
      '2026-11-06T10:20:30.456Z call tool=list_upgrade_plan service=checkout-api result=ok ms=3',
      '2026-11-06T10:20:30.456Z call tool=rerun_ci_job service=checkout-api result=UNKNOWN_RUN ms=0',
    ]);
  });

  it('shows a dash when the service is unknown or missing (NFR1.7)', () => {
    const { lines, logger } = capture();
    logger.call({
      tool: 'list_failed_ci_runs',
      service: undefined,
      result: 'UNKNOWN_SERVICE',
      ms: 1,
    });
    expect(lines[0]).toContain(' service=- ');
  });

  it('never lets markup, line breaks or very long text reach the line', () => {
    const { lines, logger } = capture();
    const odd = [
      '<script>alert(1)</script>',
      'line one\nline two',
      'x'.repeat(10000),
      'Has Capitals',
      '',
    ];
    for (const service of odd) {
      logger.call({
        tool: 'list_upgrade_plan',
        service,
        result: 'UNKNOWN_SERVICE',
        ms: 2,
      });
    }
    expect(lines).toHaveLength(odd.length);
    for (const line of lines) {
      expect(line).toContain(' service=- ');
      expect(line).not.toContain('\n');
      expect(line.length).toBeLessThan(200);
    }
  });

  it('writes to standard output with a line feed by default', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      createLogger().start({ seed: 1, failureMode: 'off', port: 2 });
      expect(spy).toHaveBeenCalledTimes(1);
      const written = String(spy.mock.calls[0][0]);
      expect(written).toMatch(
        /^\d{4}-\d{2}-\d{2}T[\d:.]+Z start seed=1 failure=off port=2\n$/,
      );
    } finally {
      spy.mockRestore();
    }
  });
});
