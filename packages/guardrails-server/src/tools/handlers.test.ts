import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ERROR_MESSAGES, mapError, ToolError } from '../errors';
import { DEFAULT_SEED, generateDataSet } from '../generator';
import { createLogger } from '../logger';
import { GuardrailsData } from '../store';
import { createToolHandlers, TOOL_NAMES, type ToolData } from './handlers';

const dataSet = generateDataSet(DEFAULT_SEED);

function setup(options: { failureMode?: boolean; data?: ToolData } = {}) {
  const lines: string[] = [];
  const data = new GuardrailsData(dataSet);
  const handlers = createToolHandlers({
    data: options.data ?? data,
    failureMode: options.failureMode ?? false,
    logger: createLogger({
      write: line => lines.push(line),
      now: () => new Date('2026-11-06T00:00:00.000Z'),
    }),
  });
  return { handlers, data, lines };
}

function code(result: CallToolResult): unknown {
  return (result.structuredContent as { code?: string } | undefined)?.code;
}

const behind = dataSet.dependencies.find(
  d => d.currentVersion !== d.recommendedVersion,
)!;
const current = dataSet.dependencies.find(
  d => d.currentVersion === d.recommendedVersion,
)!;
const failed = dataSet.ciRuns.find(r => r.status === 'failed')!;
const otherService = dataSet.services.find(
  s => s.serviceName !== behind.serviceName,
)!.serviceName;
const noDepsService = dataSet.services.find(
  s => !dataSet.dependencies.some(d => d.serviceName === s.serviceName),
)!.serviceName;
const noFailedService = dataSet.services.find(
  s =>
    !dataSet.ciRuns.some(
      r => r.serviceName === s.serviceName && r.status === 'failed',
    ),
)!.serviceName;

describe('tool handlers: success paths', () => {
  it('registers exactly the four tools', () => {
    expect([...TOOL_NAMES]).toEqual([
      'list_upgrade_plan',
      'list_failed_ci_runs',
      'apply_dependency_upgrade',
      'rerun_ci_job',
    ]);
    expect(Object.keys(setup().handlers).sort()).toEqual(
      [...TOOL_NAMES].sort(),
    );
  });

  it('lists the upgrade plan ordered by name with both versions (BR2.1)', () => {
    const { handlers } = setup();
    const result = handlers.list_upgrade_plan({ service: behind.serviceName });
    expect(result.isError).toBeFalsy();
    const out = result.structuredContent as {
      service: string;
      dependencies: Array<{ name: string; dependencyKey: string }>;
    };
    expect(out.service).toBe(behind.serviceName);
    const names = out.dependencies.map(d => d.name);
    expect(names).toEqual([...names].sort());
    expect(out.dependencies).toContainEqual({
      dependencyKey: behind.dependencyKey,
      name: behind.name,
      currentVersion: behind.currentVersion,
      recommendedVersion: behind.recommendedVersion,
    });
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual(
      out,
    );
  });

  it('lists failed runs newest first with their causes (BR2.2)', () => {
    const { handlers } = setup();
    const result = handlers.list_failed_ci_runs({
      service: failed.serviceName,
    });
    const out = result.structuredContent as {
      service: string;
      runs: Array<{ runNumber: number; status: string; cause: string }>;
    };
    expect(out.service).toBe(failed.serviceName);
    const numbers = out.runs.map(r => r.runNumber);
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
    expect(out.runs.every(r => r.status === 'failed' && r.cause)).toBe(true);
    expect(out.runs).toContainEqual({
      runKey: failed.runKey,
      runNumber: failed.runNumber,
      status: 'failed',
      cause: failed.cause,
    });
  });

  it('returns empty lists, not errors, for a service with nothing to list', () => {
    const { handlers } = setup();
    const plan = handlers.list_upgrade_plan({ service: noDepsService });
    expect(plan.isError).toBeFalsy();
    expect(plan.structuredContent).toEqual({
      service: noDepsService,
      dependencies: [],
    });
    const runs = handlers.list_failed_ci_runs({ service: noFailedService });
    expect(runs.isError).toBeFalsy();
    expect(runs.structuredContent).toEqual({
      service: noFailedService,
      runs: [],
    });
  });

  it('applies an upgrade and repeats safely (BR2.3, NFR7.5)', () => {
    const { handlers, data } = setup();
    const args = {
      service: behind.serviceName,
      dependencyKey: behind.dependencyKey,
    };
    expect(handlers.apply_dependency_upgrade(args).structuredContent).toEqual({
      dependencyKey: behind.dependencyKey,
      currentVersion: behind.recommendedVersion,
      result: 'applied',
    });
    expect(handlers.apply_dependency_upgrade(args).structuredContent).toEqual({
      dependencyKey: behind.dependencyKey,
      currentVersion: behind.recommendedVersion,
      result: 'already-current',
    });
    expect(data.overlay.upgradedDependencies.size).toBe(1);
    const plan = handlers.list_upgrade_plan({ service: behind.serviceName })
      .structuredContent as {
      dependencies: Array<{ dependencyKey: string; currentVersion: string }>;
    };
    expect(
      plan.dependencies.find(d => d.dependencyKey === behind.dependencyKey)!
        .currentVersion,
    ).toBe(behind.recommendedVersion);
    const noop = handlers.apply_dependency_upgrade({
      service: current.serviceName,
      dependencyKey: current.dependencyKey,
    });
    expect(noop.structuredContent).toMatchObject({ result: 'already-current' });
  });

  it('re-runs a job and repeats safely (BR2.4)', () => {
    const { handlers, data } = setup();
    const args = { service: failed.serviceName, runKey: failed.runKey };
    const expected = { runKey: failed.runKey, result: 'rerun-started' };
    expect(handlers.rerun_ci_job(args).structuredContent).toEqual(expected);
    expect(handlers.rerun_ci_job(args).structuredContent).toEqual(expected);
    expect(data.overlay.rerunRuns.size).toBe(1);
    const runs = handlers.list_failed_ci_runs({ service: failed.serviceName })
      .structuredContent as { runs: Array<{ runKey: string }> };
    expect(runs.runs.some(r => r.runKey === failed.runKey)).toBe(false);
  });

  it('ignores extra fields (BR3.4)', () => {
    const { handlers } = setup();
    const result = handlers.list_upgrade_plan({
      service: behind.serviceName,
      extra: 'ignored',
      nested: { a: 1 },
    });
    expect(result.isError).toBeFalsy();
  });
});

describe('tool handlers: errors and check order', () => {
  it('returns UNKNOWN_SERVICE with a fixed message and the same text (BR3.3)', () => {
    const { handlers } = setup();
    const calls: CallToolResult[] = [
      handlers.list_upgrade_plan({ service: 'no-such-service' }),
      handlers.list_failed_ci_runs({ service: 'no-such-service' }),
      handlers.apply_dependency_upgrade({
        service: 'no-such-service',
        dependencyKey: 'x',
      }),
      handlers.rerun_ci_job({ service: 'no-such-service', runKey: 'x' }),
    ];
    for (const result of calls) {
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toEqual({
        code: 'UNKNOWN_SERVICE',
        message: ERROR_MESSAGES.UNKNOWN_SERVICE,
      });
      expect(result.content).toEqual([
        { type: 'text', text: ERROR_MESSAGES.UNKNOWN_SERVICE },
      ]);
    }
  });

  it('returns UNKNOWN_DEPENDENCY and UNKNOWN_RUN, including keys of another service', () => {
    const { handlers } = setup();
    expect(
      code(
        handlers.apply_dependency_upgrade({
          service: behind.serviceName,
          dependencyKey: 'nope',
        }),
      ),
    ).toBe('UNKNOWN_DEPENDENCY');
    expect(
      code(
        handlers.apply_dependency_upgrade({
          service: otherService,
          dependencyKey: behind.dependencyKey,
        }),
      ),
    ).toBe('UNKNOWN_DEPENDENCY');
    expect(
      code(
        handlers.rerun_ci_job({ service: failed.serviceName, runKey: 'nope' }),
      ),
    ).toBe('UNKNOWN_RUN');
    const foreignService = dataSet.services.find(
      s => s.serviceName !== failed.serviceName,
    )!.serviceName;
    expect(
      code(
        handlers.rerun_ci_job({
          service: foreignService,
          runKey: failed.runKey,
        }),
      ),
    ).toBe('UNKNOWN_RUN');
  });

  it.each([
    ['missing', {}],
    ['empty', { service: '' }],
    ['a number', { service: 7 }],
    ['an object', { service: { a: 1 } }],
    ['null', { service: null }],
  ])('returns INVALID_INPUT when the service is %s', (_label, args) => {
    const { handlers } = setup();
    for (const name of TOOL_NAMES) {
      expect(code(handlers[name](args))).toBe('INVALID_INPUT');
    }
  });

  it.each([undefined, null, 'text', 42, ['a']])(
    'returns INVALID_INPUT when the whole input is %p',
    args => {
      const { handlers } = setup();
      for (const name of TOOL_NAMES) {
        expect(code(handlers[name](args))).toBe('INVALID_INPUT');
      }
    },
  );

  it('returns INVALID_INPUT for a missing or empty key (BR3.4)', () => {
    const { handlers } = setup();
    const service = behind.serviceName;
    expect(code(handlers.apply_dependency_upgrade({ service }))).toBe(
      'INVALID_INPUT',
    );
    expect(
      code(handlers.apply_dependency_upgrade({ service, dependencyKey: '' })),
    ).toBe('INVALID_INPUT');
    expect(code(handlers.rerun_ci_job({ service }))).toBe('INVALID_INPUT');
    expect(code(handlers.rerun_ci_job({ service, runKey: 3 }))).toBe(
      'INVALID_INPUT',
    );
  });

  it('checks the input form before the service, and the service before the key', () => {
    const { handlers } = setup();
    expect(
      code(handlers.apply_dependency_upgrade({ service: 'no-such-service' })),
    ).toBe('INVALID_INPUT');
    expect(
      code(
        handlers.apply_dependency_upgrade({
          service: 'no-such-service',
          dependencyKey: 'also-unknown',
        }),
      ),
    ).toBe('UNKNOWN_SERVICE');
  });

  it('returns FORCED_FAILURE before every other check and changes nothing (BR3.1)', () => {
    const { handlers, data } = setup({ failureMode: true });
    const inputs: unknown[] = [
      { service: behind.serviceName },
      {
        service: behind.serviceName,
        dependencyKey: behind.dependencyKey,
        runKey: failed.runKey,
      },
      {},
      undefined,
      { service: 'no-such-service' },
      { service: '' },
    ];
    for (const name of TOOL_NAMES) {
      for (const args of inputs) {
        const result = handlers[name](args);
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toEqual({
          code: 'FORCED_FAILURE',
          message: ERROR_MESSAGES.FORCED_FAILURE,
        });
      }
    }
    expect(data.overlay.upgradedDependencies.size).toBe(0);
    expect(data.overlay.rerunRuns.size).toBe(0);
  });

  it('turns an unexpected error into INTERNAL_ERROR without the caller text and keeps going', () => {
    const real = new GuardrailsData(dataSet);
    let calls = 0;
    const flaky: ToolData = {
      hasService: name => real.hasService(name),
      plan: name => {
        calls += 1;
        if (calls === 1) {
          throw new Error('secret <b>caller text</b>');
        }
        return real.plan(name);
      },
      failedRuns: name => real.failedRuns(name),
      applyUpgrade: (s, k) => real.applyUpgrade(s, k),
      rerun: (s, k) => real.rerun(s, k),
    };
    const { handlers, lines } = setup({ data: flaky });
    const first = handlers.list_upgrade_plan({ service: behind.serviceName });
    expect(first.isError).toBe(true);
    expect(first.structuredContent).toEqual({
      code: 'INTERNAL_ERROR',
      message: ERROR_MESSAGES.INTERNAL_ERROR,
    });
    expect(JSON.stringify(first)).not.toContain('secret');
    expect(lines[0]).toContain('result=INTERNAL_ERROR');
    expect(lines[0]).not.toContain('secret');
    const second = handlers.list_upgrade_plan({ service: behind.serviceName });
    expect(second.isError).toBeFalsy();
  });

  it('maps errors to codes: known codes stay, anything else is INTERNAL_ERROR', () => {
    expect(mapError(new ToolError('UNKNOWN_RUN'))).toBe('UNKNOWN_RUN');
    expect(mapError(new Error('boom'))).toBe('INTERNAL_ERROR');
    expect(mapError('a string')).toBe('INTERNAL_ERROR');
    expect(new ToolError('INVALID_INPUT').message).toBe(
      ERROR_MESSAGES.INVALID_INPUT,
    );
  });
});

describe('tool handlers: one log line per call', () => {
  it('logs every call, success or error, with a dash for an unknown service', () => {
    const { handlers, lines } = setup();
    const odd = `<i>markup</i>\n${'y'.repeat(10000)}`;
    handlers.list_upgrade_plan({ service: behind.serviceName });
    handlers.list_failed_ci_runs({ service: odd });
    handlers.apply_dependency_upgrade({ service: behind.serviceName });
    handlers.rerun_ci_job({
      service: failed.serviceName,
      runKey: failed.runKey,
    });
    handlers.rerun_ci_job(undefined);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatch(
      new RegExp(
        ` call tool=list_upgrade_plan service=${behind.serviceName} result=ok ms=\\d+$`,
      ),
    );
    expect(lines[1]).toMatch(
      / call tool=list_failed_ci_runs service=- result=UNKNOWN_SERVICE ms=\d+$/,
    );
    expect(lines[2]).toContain(
      `tool=apply_dependency_upgrade service=${behind.serviceName} result=INVALID_INPUT`,
    );
    expect(lines[3]).toContain('result=ok');
    expect(lines[4]).toContain(
      'tool=rerun_ci_job service=- result=INVALID_INPUT',
    );
    expect(lines.join('\n')).not.toContain('markup');
  });

  it('logs the known service name even when the failure gate refuses the call', () => {
    const { handlers, lines } = setup({ failureMode: true });
    handlers.list_upgrade_plan({ service: behind.serviceName });
    expect(lines[0]).toContain(
      `service=${behind.serviceName} result=FORCED_FAILURE`,
    );
  });

  it('keeps logging when the service check itself throws', () => {
    const real = new GuardrailsData(dataSet);
    const broken: ToolData = {
      hasService: () => {
        throw new Error('broken');
      },
      plan: n => real.plan(n),
      failedRuns: n => real.failedRuns(n),
      applyUpgrade: (s, k) => real.applyUpgrade(s, k),
      rerun: (s, k) => real.rerun(s, k),
    };
    const { handlers, lines } = setup({ data: broken });
    const result = handlers.list_upgrade_plan({ service: behind.serviceName });
    expect(code(result)).toBe('INTERNAL_ERROR');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('service=-');
  });
});
