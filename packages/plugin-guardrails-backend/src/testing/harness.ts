import type { LoggerService } from '@backstage/backend-plugin-api';
import type { Knex } from 'knex';
import type {
  TestDatabaseId,
  TestDatabases,
} from '@backstage/backend-test-utils';
import { initMigrated } from './testDatabases';
import { createFakeClock, type FakeClock } from './fakeClock';
import { startStandIn, type StandIn } from './standInServer';
import { createGuardrailsClient } from '../server/guardrailsClient';
import type { GuardrailsClient } from '../server/guardrailsClient';
import { createServerHealth, type ServerHealth } from '../server/serverHealth';
import { createAuditStore } from '../store/auditStore';
import { createChangeStore } from '../store/changeStore';
import type { AuditStore, ChangeStore } from '../store/types';
import {
  createChangeWorkflow,
  type ChangeWorkflow,
} from '../workflow/changeWorkflow';
import { createRecovery, type Recovery } from '../workflow/recovery';
import { findDemoUser, type DemoUser } from '../identity/demoUsers';

export interface CapturedLogger extends LoggerService {
  lines: string[];
}

export function createCapturingLogger(): CapturedLogger {
  const lines: string[] = [];
  const write = (level: string) => (message: string, meta?: unknown) => {
    lines.push(
      `${level} ${message} ${meta ? JSON.stringify(meta) : ''}`.trim(),
    );
  };
  const logger: CapturedLogger = {
    lines,
    error: write('error'),
    warn: write('warn'),
    info: write('info'),
    debug: write('debug'),
    child: () => logger,
  };
  return logger;
}

export const sam = findDemoUser('sam') as DemoUser;
export const priya = findDemoUser('priya') as DemoUser;
export const alex = findDemoUser('alex') as DemoUser;

export interface Harness {
  knex: Knex;
  changes: ChangeStore;
  audit: AuditStore;
  standIn: StandIn;
  clock: FakeClock;
  client: GuardrailsClient;
  health: ServerHealth;
  recovery: Recovery;
  workflow: ChangeWorkflow;
  logger: CapturedLogger;
  close(): Promise<void>;
}

export interface HarnessOptions {
  readTimeoutMs?: number;
  writeTimeoutMs?: number;
}

/**
 * Everything a workflow test needs: a migrated database, the stand-in server,
 * a clock the test controls and deterministic ids.
 */
export async function createHarness(
  databases: TestDatabases,
  id: TestDatabaseId,
  options: HarnessOptions = {},
): Promise<Harness> {
  const knex = await initMigrated(databases, id);
  const standIn = await startStandIn();
  const clock = createFakeClock();
  const logger = createCapturingLogger();
  const changes = createChangeStore(knex);
  const audit = createAuditStore(knex);
  const client = createGuardrailsClient({
    url: standIn.url,
    readTimeoutMs: options.readTimeoutMs ?? 3000,
    writeTimeoutMs: options.writeTimeoutMs ?? 10000,
  });
  const health = createServerHealth({
    probe: () => client.checkHealth(),
    clock,
  });
  const recovery = createRecovery({ changes, audit, clock, logger });
  let counter = 0;
  const workflow = createChangeWorkflow({
    changes,
    audit,
    client,
    health,
    recovery,
    clock,
    logger,
    ids: {
      changeId: () => `chg-${String(++counter).padStart(4, '0')}`,
      token: () => `token-${++counter}`,
    },
  });
  return {
    knex,
    changes,
    audit,
    standIn,
    clock,
    client,
    health,
    recovery,
    workflow,
    logger,
    async close() {
      await client.close();
      await standIn.close();
      await knex.destroy();
    },
  };
}
