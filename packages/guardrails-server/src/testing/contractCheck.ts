import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** The JSON Schema subset the C2 spec uses: type, required, properties, items, enum. */
export interface Schema {
  type?: 'string' | 'integer' | 'object' | 'array';
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: string[];
}

export interface ToolSpec {
  name: string;
  kind: 'read' | 'write';
  timeoutMs: number;
  idempotent: boolean;
  input: Schema;
  output: Schema;
  errors: string[];
}

export interface ContractSpec {
  contract: string;
  endpoint: string;
  transport: string;
  errorCodes: string[];
  errorResult: { structuredContent: Schema };
  failureMode: { setting: string; values: string[]; default: string };
  tools: ToolSpec[];
}

/**
 * Loads the C2 spec file kept in this unit. The same check is meant to be run
 * by u2 against its stand-in for the server.
 */
export function loadSpec(
  // Test helper only: the spec sits next to src, never in a production build.
  // eslint-disable-next-line no-restricted-syntax
  file = path.join(__dirname, '..', '..', 'contract', 'c2-tools.json'),
): ContractSpec {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ContractSpec;
}

/** Returns the problems found when `value` is checked against `schema`; empty means it matches. */
export function validateSchema(
  schema: Schema,
  value: unknown,
  at = '$',
): string[] {
  const problems: string[] = [];
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        problems.push(`${at}: expected a string`);
      }
      break;
    case 'integer':
      if (!Number.isInteger(value)) {
        problems.push(`${at}: expected a whole number`);
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        problems.push(`${at}: expected a list`);
      } else if (schema.items) {
        const items = schema.items;
        value.forEach((item, i) =>
          problems.push(...validateSchema(items, item, `${at}[${i}]`)),
        );
      }
      break;
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        problems.push(`${at}: expected an object`);
      } else {
        const record = value as Record<string, unknown>;
        for (const key of schema.required ?? []) {
          if (!(key in record)) {
            problems.push(`${at}.${key}: missing`);
          }
        }
        for (const [key, child] of Object.entries(schema.properties ?? {})) {
          if (key in record) {
            problems.push(
              ...validateSchema(child, record[key], `${at}.${key}`),
            );
          }
        }
      }
      break;
    default:
      break;
  }
  if (schema.enum && !schema.enum.includes(value as string)) {
    problems.push(
      `${at}: ${JSON.stringify(value)} is not one of the listed values`,
    );
  }
  return problems;
}

/** Checks one tool result against the spec: success output shape, or error code and message. */
export function checkToolResult(
  spec: ContractSpec,
  toolName: string,
  result: CallToolResult,
): string[] {
  const tool = spec.tools.find(t => t.name === toolName);
  if (!tool) {
    return [`${toolName}: not a tool in the spec`];
  }
  const text = (result.content?.[0] as { text?: string } | undefined)?.text;
  if (result.isError) {
    const problems = validateSchema(
      spec.errorResult.structuredContent,
      result.structuredContent,
      'error',
    );
    const { code, message } = (result.structuredContent ?? {}) as {
      code?: string;
      message?: string;
    };
    if (code !== undefined && !tool.errors.includes(code)) {
      problems.push(`error.code: ${code} is not listed for ${toolName}`);
    }
    if (message !== undefined && text !== message) {
      problems.push('error: the text content differs from the message');
    }
    return problems;
  }
  const problems = validateSchema(
    tool.output,
    result.structuredContent,
    'output',
  );
  if (text === undefined || JSON.stringify(result.structuredContent) !== text) {
    problems.push(
      'output: the text content differs from the structured content',
    );
  }
  return problems;
}
