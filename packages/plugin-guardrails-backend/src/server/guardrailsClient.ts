import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/** The error codes of contract C2. Anything else counts as UNKNOWN (BR3.9). */
export const KNOWN_SERVER_CODES = [
  'UNKNOWN_SERVICE',
  'UNKNOWN_DEPENDENCY',
  'UNKNOWN_RUN',
  'INVALID_INPUT',
  'FORCED_FAILURE',
  'INTERNAL_ERROR',
] as const;
export type ServerErrorCode = (typeof KNOWN_SERVER_CODES)[number] | 'UNKNOWN';

export type CallErrorKind = 'tool-error' | 'timeout' | 'unavailable';

const CALL_ERROR_MESSAGES: Record<CallErrorKind, string> = {
  timeout: 'The guardrails server did not answer in time.',
  unavailable: 'The guardrails server could not be reached.',
  'tool-error': 'The guardrails server reported an error.',
};

/**
 * A call to the guardrails server that did not succeed. The message is a fixed
 * sentence: server text is never passed on (it could hold anything).
 */
export class GuardrailsCallError extends Error {
  readonly kind: CallErrorKind;
  readonly code?: ServerErrorCode;

  constructor(kind: CallErrorKind, code?: ServerErrorCode) {
    super(CALL_ERROR_MESSAGES[kind]);
    this.name = 'GuardrailsCallError';
    this.kind = kind;
    this.code = code;
  }
}

export interface PlanDependency {
  dependencyKey: string;
  name: string;
  currentVersion: string;
  recommendedVersion: string;
}

export interface FailedRun {
  runKey: string;
  runNumber: number;
  status: string;
  cause: string;
}

export interface GuardrailsClient {
  listUpgradePlan(service: string): Promise<PlanDependency[]>;
  listFailedCiRuns(service: string): Promise<FailedRun[]>;
  applyDependencyUpgrade(
    service: string,
    dependencyKey: string,
  ): Promise<{ result: string }>;
  rerunCiJob(service: string, runKey: string): Promise<{ result: string }>;
  /** True when the health route answers 200 within the time (BR7.1). */
  checkHealth(timeoutMs?: number): Promise<boolean>;
  close(): Promise<void>;
}

export interface GuardrailsClientOptions {
  /** Address of the guardrails server, from settings. */
  url: string;
  readTimeoutMs: number;
  writeTimeoutMs: number;
}

const planSchema = z.object({
  dependencies: z.array(
    z.object({
      dependencyKey: z.string(),
      name: z.string(),
      currentVersion: z.string(),
      recommendedVersion: z.string(),
    }),
  ),
});
const runsSchema = z.object({
  runs: z.array(
    z.object({
      runKey: z.string(),
      runNumber: z.number(),
      status: z.string(),
      cause: z.string(),
    }),
  ),
});
const resultSchema = z.object({ result: z.string() });

const DEFAULT_HEALTH_TIMEOUT_MS = 1000;

function toCallError(error: unknown): GuardrailsCallError {
  if (error instanceof GuardrailsCallError) {
    return error;
  }
  if (error instanceof McpError && error.code === ErrorCode.RequestTimeout) {
    return new GuardrailsCallError('timeout');
  }
  return new GuardrailsCallError('unavailable');
}

function codeOf(structured: unknown): ServerErrorCode {
  const code = (structured as { code?: unknown } | undefined)?.code;
  return (KNOWN_SERVER_CODES as readonly unknown[]).includes(code)
    ? (code as ServerErrorCode)
    : 'UNKNOWN';
}

class McpGuardrailsClient implements GuardrailsClient {
  private readonly baseUrl: string;
  private connecting?: Promise<Client>;

  constructor(private readonly options: GuardrailsClientOptions) {
    this.baseUrl = options.url.replace(/\/+$/, '');
  }

  listUpgradePlan(service: string): Promise<PlanDependency[]> {
    return this.call('list_upgrade_plan', { service }, 'read').then(
      value => this.shape(planSchema, value).dependencies,
    );
  }

  listFailedCiRuns(service: string): Promise<FailedRun[]> {
    return this.call('list_failed_ci_runs', { service }, 'read').then(
      value => this.shape(runsSchema, value).runs,
    );
  }

  applyDependencyUpgrade(service: string, dependencyKey: string) {
    return this.call(
      'apply_dependency_upgrade',
      { service, dependencyKey },
      'write',
    ).then(value => this.shape(resultSchema, value));
  }

  rerunCiJob(service: string, runKey: string) {
    return this.call('rerun_ci_job', { service, runKey }, 'write').then(value =>
      this.shape(resultSchema, value),
    );
  }

  async checkHealth(timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/healthz`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.body?.cancel();
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.reset();
  }

  /** An answer that does not have the shape of the spec is a failed call. */
  private shape<S extends z.ZodTypeAny>(
    schema: S,
    value: unknown,
  ): z.output<S> {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new GuardrailsCallError('tool-error', 'UNKNOWN');
    }
    return result.data;
  }

  private getClient(timeoutMs: number): Promise<Client> {
    if (!this.connecting) {
      const client = new Client({
        name: 'guardrails-plugin-backend',
        version: '0.1.0',
      });
      const transport = new StreamableHTTPClientTransport(
        new URL(`${this.baseUrl}/mcp`),
      );
      this.connecting = client
        .connect(transport, { timeout: timeoutMs })
        .then(() => client)
        .catch(error => {
          this.connecting = undefined;
          throw error;
        });
    }
    return this.connecting;
  }

  private async reset(): Promise<void> {
    const pending = this.connecting;
    this.connecting = undefined;
    if (pending) {
      try {
        await (await pending).close();
      } catch {
        // The connection is being dropped anyway.
      }
    }
  }

  /** One call, one timeout, no retry (BR7.2). */
  private async call(
    tool: string,
    args: Record<string, string>,
    kind: 'read' | 'write',
  ): Promise<unknown> {
    const timeout =
      kind === 'read'
        ? this.options.readTimeoutMs
        : this.options.writeTimeoutMs;
    try {
      const client = await this.getClient(timeout);
      const result = await client.callTool(
        { name: tool, arguments: args },
        undefined,
        { timeout },
      );
      if (result.isError) {
        throw new GuardrailsCallError(
          'tool-error',
          codeOf(result.structuredContent),
        );
      }
      return result.structuredContent;
    } catch (error) {
      const callError = toCallError(error);
      if (callError.kind === 'unavailable') {
        await this.reset();
      }
      throw callError;
    }
  }
}

export function createGuardrailsClient(
  options: GuardrailsClientOptions,
): GuardrailsClient {
  return new McpGuardrailsClient(options);
}
