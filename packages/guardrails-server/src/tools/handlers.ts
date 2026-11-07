import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  mapError,
  ToolError,
  toolErrorResult,
  toolSuccessResult,
  type ToolErrorCode,
} from '../errors';
import type { Logger } from '../logger';
import type { GuardrailsData } from '../store';

/** Exactly four tools; no other tool, route or file returns the data (BR4.3). */
export const TOOL_NAMES = [
  'list_upgrade_plan',
  'list_failed_ci_runs',
  'apply_dependency_upgrade',
  'rerun_ci_job',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolHandler = (args: unknown) => CallToolResult;
export type ToolHandlers = Record<ToolName, ToolHandler>;

/** What the handlers need from the data layer. */
export type ToolData = Pick<
  GuardrailsData,
  'hasService' | 'plan' | 'failedRuns' | 'applyUpgrade' | 'rerun'
>;

export interface ToolDeps {
  data: ToolData;
  /** Read once at start; when true every call fails first (BR3.1). */
  failureMode: boolean;
  logger: Logger;
  /** Milliseconds, for the call duration only. */
  clock?: () => number;
}

type Fields = Record<string, string>;

function readFields(args: unknown, names: readonly string[]): Fields {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new ToolError('INVALID_INPUT');
  }
  const record = args as Record<string, unknown>;
  const fields: Fields = {};
  for (const name of names) {
    const value = record[name];
    if (typeof value !== 'string' || value.length === 0) {
      throw new ToolError('INVALID_INPUT');
    }
    fields[name] = value;
  }
  return fields;
}

function requireService(data: ToolData, service: string): void {
  if (!data.hasService(service)) {
    throw new ToolError('UNKNOWN_SERVICE');
  }
}

/**
 * Builds the four handlers. Every handler runs the same fixed order (BR3.3):
 * the failure gate (FORCED_FAILURE), the input form (INVALID_INPUT), the
 * service (UNKNOWN_SERVICE), then the dependency or run key. Unexpected
 * errors become INTERNAL_ERROR and every call writes one log line.
 */
export function createToolHandlers(deps: ToolDeps): ToolHandlers {
  const { data, failureMode, logger } = deps;
  const clock = deps.clock ?? (() => performance.now());

  const knownService = (args: unknown): string | undefined => {
    try {
      const service = (args as { service?: unknown } | null | undefined)
        ?.service;
      return typeof service === 'string' && data.hasService(service)
        ? service
        : undefined;
    } catch {
      return undefined;
    }
  };

  const handler =
    (
      tool: ToolName,
      fieldNames: readonly string[],
      execute: (fields: Fields) => Record<string, unknown>,
    ): ToolHandler =>
    args => {
      const started = clock();
      let result: CallToolResult;
      let outcome: 'ok' | ToolErrorCode = 'ok';
      try {
        if (failureMode) {
          throw new ToolError('FORCED_FAILURE');
        }
        result = toolSuccessResult(execute(readFields(args, fieldNames)));
      } catch (error) {
        outcome = mapError(error);
        result = toolErrorResult(outcome);
      }
      logger.call({
        tool,
        service: knownService(args),
        result: outcome,
        ms: clock() - started,
      });
      return result;
    };

  return {
    list_upgrade_plan: handler('list_upgrade_plan', ['service'], fields => {
      requireService(data, fields.service);
      return {
        service: fields.service,
        dependencies: data.plan(fields.service) ?? [],
      };
    }),
    list_failed_ci_runs: handler('list_failed_ci_runs', ['service'], fields => {
      requireService(data, fields.service);
      return {
        service: fields.service,
        runs: data.failedRuns(fields.service) ?? [],
      };
    }),
    apply_dependency_upgrade: handler(
      'apply_dependency_upgrade',
      ['service', 'dependencyKey'],
      fields => {
        const outcome = data.applyUpgrade(fields.service, fields.dependencyKey);
        if (!outcome.ok) {
          throw new ToolError(outcome.code);
        }
        return { ...outcome.value };
      },
    ),
    rerun_ci_job: handler('rerun_ci_job', ['service', 'runKey'], fields => {
      const outcome = data.rerun(fields.service, fields.runKey);
      if (!outcome.ok) {
        throw new ToolError(outcome.code);
      }
      return { ...outcome.value };
    }),
  };
}
