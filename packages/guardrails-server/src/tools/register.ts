import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolHandlers, ToolName } from './handlers';

// Every input is registered with a permissive shape so the kit rejects
// nothing before the handler runs and the order of checks stays ours
// (BR3.3, NFR5.3). The handler checks that each value is non-empty text.
const anything = (description: string) =>
  z.unknown().optional().describe(description);

interface ToolSpec {
  description: string;
  inputShape: Record<string, z.ZodTypeAny>;
  readOnly: boolean;
}

const TOOLS: Record<ToolName, ToolSpec> = {
  list_upgrade_plan: {
    description:
      'List every dependency of a service with its current and recommended version, ordered by name.',
    inputShape: { service: anything('Service name (text)') },
    readOnly: true,
  },
  list_failed_ci_runs: {
    description:
      'List the currently failed CI runs of a service with their causes, newest first.',
    inputShape: { service: anything('Service name (text)') },
    readOnly: true,
  },
  apply_dependency_upgrade: {
    description:
      "Set a dependency's current version to its recommended version. Safe to repeat.",
    inputShape: {
      service: anything('Service name (text)'),
      dependencyKey: anything('Dependency key (text)'),
    },
    readOnly: false,
  },
  rerun_ci_job: {
    description:
      'Re-run a CI job so it leaves the failed list. Safe to repeat.',
    inputShape: {
      service: anything('Service name (text)'),
      runKey: anything('Run key (text)'),
    },
    readOnly: false,
  },
};

/** Registers exactly the four tools on a server. */
export function registerTools(server: McpServer, handlers: ToolHandlers): void {
  for (const [name, spec] of Object.entries(TOOLS) as Array<
    [ToolName, ToolSpec]
  >) {
    server.registerTool(
      name,
      {
        description: spec.description,
        inputSchema: spec.inputShape,
        annotations: spec.readOnly
          ? { readOnlyHint: true }
          : {
              readOnlyHint: false,
              idempotentHint: true,
              destructiveHint: false,
            },
      },
      async args => handlers[name](args),
    );
  }
}
