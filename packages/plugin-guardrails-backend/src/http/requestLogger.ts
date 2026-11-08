import type { LoggerService } from '@backstage/backend-plugin-api';
import type { NextFunction, Request, Response } from 'express';
import { isoNow, type Clock } from '../clock';

export interface RequestLoggerOptions {
  logger: LoggerService;
  clock: Clock;
}

/**
 * One line per request with fixed fields only: time, method, route pattern,
 * actor id, status, error code and duration (NFR2.10, NFR5.8). The logger is
 * handed no body, no query value, no header and no setting, so it cannot
 * write a reason, a login or a token.
 */
export function createRequestLogger(options: RequestLoggerOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const started = performance.now();
    res.on('finish', () => {
      const route = req.route?.path
        ? `${req.baseUrl}${req.route.path}`
        : 'unmatched';
      const actor = (res.locals.actorId as string | undefined) ?? '-';
      const code = (res.locals.errorCode as string | undefined) ?? '-';
      const duration = Math.round(performance.now() - started);
      options.logger.info(
        `Request time=${isoNow(options.clock)} method=${req.method} route=${route} actor=${actor} status=${res.statusCode} code=${code} durationMs=${duration}`,
      );
    });
    next();
  };
}
