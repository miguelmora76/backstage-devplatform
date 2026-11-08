import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { systemClock } from './clock';
import { migrate } from './database/migrate';
import { createRouter } from './http/router';
import { createIdGenerator } from './ids';
import { createGuardrailsClient } from './server/guardrailsClient';
import { createServerHealth } from './server/serverHealth';
import { readSettings } from './settings';
import { createAuditStore } from './store/auditStore';
import { createChangeStore } from './store/changeStore';
import { createChangeWorkflow } from './workflow/changeWorkflow';
import { createRecovery } from './workflow/recovery';

/**
 * The guardrails backend plugin (plugin id `guardrails`, contract C3). Routes
 * are served under `/api/guardrails`. Migrations run at start-up and the
 * plugin reports ready only after they finish (NFR2.4, NFR2.11).
 */
export const guardrailsPlugin = createBackendPlugin({
  pluginId: 'guardrails',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        database: coreServices.database,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        lifecycle: coreServices.lifecycle,
      },
      async init({
        logger,
        config,
        database,
        httpRouter,
        httpAuth,
        lifecycle,
      }) {
        const settings = readSettings(config);

        const knex = await database.getClient();
        await migrate(knex);

        const clock = systemClock;
        const changes = createChangeStore(knex);
        const audit = createAuditStore(knex);
        const client = createGuardrailsClient({
          url: settings.serverUrl,
          readTimeoutMs: settings.readTimeoutMs,
          writeTimeoutMs: settings.writeTimeoutMs,
        });
        lifecycle.addShutdownHook(() => client.close());

        const health = createServerHealth({
          probe: () => client.checkHealth(),
          clock,
        });
        const recovery = createRecovery({ changes, audit, clock, logger });
        const workflow = createChangeWorkflow({
          changes,
          audit,
          client,
          health,
          recovery,
          clock,
          ids: createIdGenerator(clock),
          logger,
        });

        if (settings.demoSignInEnabled) {
          // The user list is read before anyone has signed in.
          httpRouter.addAuthPolicy({
            path: '/demo-users',
            allow: 'unauthenticated',
          });
        }
        httpRouter.use(
          createRouter({
            httpAuth,
            workflow,
            logger,
            clock,
            demoSignInEnabled: settings.demoSignInEnabled,
          }),
        );
      },
    });
  },
});
