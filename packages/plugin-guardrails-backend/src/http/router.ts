import type {
  HttpAuthService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import type { Clock } from '../clock';
import { GuardrailsError } from '../errors';
import { DEMO_USERS } from '../identity/demoUsers';
import type { DecisionAction } from '../store/types';
import type { ChangeWorkflow } from '../workflow/changeWorkflow';
import { createErrorHandler } from './errorHandler';
import { actorOf, createIdentityGuard } from './identityGuard';
import {
  parseAuditQuery,
  parseChangeId,
  parseChangesQuery,
  parseDecisionBody,
  parseProposeBody,
  parseService,
} from './inputSchemas';
import { createRequestLogger } from './requestLogger';

export interface RouterOptions {
  httpAuth: HttpAuthService;
  workflow: ChangeWorkflow;
  logger: LoggerService;
  clock: Clock;
  /** Registers the open demo user list only while the demo sign-in is on (NFR5.3). */
  demoSignInEnabled: boolean;
}

const DECISIONS: DecisionAction[] = ['approve', 'reject', 'retry'];

/**
 * The routes of contract C1. Handlers stay thin: check the input shape, call
 * the workflow, send the result. The order is the request chain of
 * security-design.md: identity, input check, workflow.
 */
export function createRouter(options: RouterOptions): express.Router {
  const { workflow } = options;
  const router = Router();

  router.use(createRequestLogger(options));

  if (options.demoSignInEnabled) {
    router.get('/demo-users', (_req, res) => {
      res.json({ items: DEMO_USERS });
    });
  }

  // Every other route needs a demo identity before anything else runs.
  router.use(createIdentityGuard(options.httpAuth));
  router.use(express.json({ limit: '64kb' }));

  router.get('/me', (_req, res) => {
    const { userId, name, role } = actorOf(res);
    res.json({ userId, name, role });
  });

  router.get('/services/:service/plan', async (req, res) => {
    res.json(
      await workflow.listPlan(actorOf(res), parseService(req.params.service)),
    );
  });

  router.get('/services/:service/ci-runs', async (req, res) => {
    res.json(
      await workflow.listCiRuns(actorOf(res), parseService(req.params.service)),
    );
  });

  router.get('/services/:service/changes', async (req, res) => {
    const service = parseService(req.params.service);
    const { status } = parseChangesQuery(req.query);
    res.json({
      service,
      items: await workflow.listChanges(actorOf(res), service, status),
    });
  });

  router.post('/services/:service/changes', async (req, res) => {
    const service = parseService(req.params.service);
    const input = parseProposeBody(req.body);
    res.status(201).json(await workflow.propose(actorOf(res), service, input));
  });

  router.get('/changes/:changeId', async (req, res) => {
    res.json(
      await workflow.getChange(
        actorOf(res),
        parseChangeId(req.params.changeId),
      ),
    );
  });

  for (const action of DECISIONS) {
    router.post(`/changes/:changeId/${action}`, async (req, res) => {
      const changeId = parseChangeId(req.params.changeId);
      const { reason } = parseDecisionBody(req.body);
      res.json(await workflow.decide(actorOf(res), action, changeId, reason));
    });
  }

  router.get('/services/:service/audit', async (req, res) => {
    const service = parseService(req.params.service);
    res.json(await workflow.readAudit(service, parseAuditQuery(req.query)));
  });

  // Nothing else exists: the audit log has no write, edit or delete route.
  router.use(() => {
    throw new GuardrailsError('NOT_FOUND');
  });
  router.use(createErrorHandler(options));
  return router;
}
