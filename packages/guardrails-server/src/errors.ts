import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * The tool error codes (BR3.3). INTERNAL_ERROR applies only when no earlier
 * check fits and a handler fails unexpectedly.
 */
export const ERROR_CODES = [
  'UNKNOWN_SERVICE',
  'UNKNOWN_DEPENDENCY',
  'UNKNOWN_RUN',
  'INVALID_INPUT',
  'FORCED_FAILURE',
  'INTERNAL_ERROR',
] as const;

export type ToolErrorCode = (typeof ERROR_CODES)[number];

/** Every message is a fixed sentence chosen by the code, never caller text (NFR5.3). */
export const ERROR_MESSAGES: Readonly<Record<ToolErrorCode, string>> = {
  UNKNOWN_SERVICE: 'The service is not known.',
  UNKNOWN_DEPENDENCY: 'The dependency is not known for this service.',
  UNKNOWN_RUN: 'The CI run is not known for this service.',
  INVALID_INPUT: 'A required input is missing or empty.',
  FORCED_FAILURE: 'The server is set to fail every call.',
  INTERNAL_ERROR: 'The server could not complete the call.',
};

export class ToolError extends Error {
  readonly code: ToolErrorCode;

  constructor(code: ToolErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'ToolError';
    this.code = code;
  }
}

/** Error mapper: a ToolError keeps its code, anything else is INTERNAL_ERROR. */
export function mapError(error: unknown): ToolErrorCode {
  return error instanceof ToolError ? error.code : 'INTERNAL_ERROR';
}

/** A tool error result: marked as an error, code and message in the structured content, same message as text. */
export function toolErrorResult(code: ToolErrorCode): CallToolResult {
  const message = ERROR_MESSAGES[code];
  return {
    isError: true,
    structuredContent: { code, message },
    content: [{ type: 'text', text: message }],
  };
}

/** A success result: the output as structured content and as JSON text. */
export function toolSuccessResult(
  output: Record<string, unknown>,
): CallToolResult {
  return {
    structuredContent: output,
    content: [{ type: 'text', text: JSON.stringify(output) }],
  };
}
