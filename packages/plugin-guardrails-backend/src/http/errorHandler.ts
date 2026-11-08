import type { LoggerService } from '@backstage/backend-plugin-api';
import type { NextFunction, Request, Response } from 'express';
import { GuardrailsError } from '../errors';

export interface ErrorHandlerOptions {
  logger: LoggerService;
}

const BODY_PARSER_TYPES = new Set([
  'entity.parse.failed',
  'entity.too.large',
  'encoding.unsupported',
  'charset.unsupported',
  'request.aborted',
]);

function isBodyParserError(error: unknown): boolean {
  const type = (error as { type?: unknown } | null)?.type;
  return typeof type === 'string' && BODY_PARSER_TYPES.has(type);
}

/**
 * The single error handler (NFR5.9). A defined error becomes its status and
 * fixed message; anything else becomes a fixed 500 with no stack, query text
 * or setting. Only the error class and the route are logged.
 */
export function createErrorHandler(options: ErrorHandlerOptions) {
  return (error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const known = isBodyParserError(error)
      ? new GuardrailsError('INVALID_INPUT', 'The request body is not valid.')
      : error;
    if (known instanceof GuardrailsError) {
      res.locals.errorCode = known.code;
      res.status(known.status).json({
        error: { code: known.code, message: known.message },
      });
      return;
    }
    options.logger.error('Unexpected error while handling a request', {
      errorClass: error instanceof Error ? error.constructor.name : 'unknown',
      route: req.route?.path ?? 'unmatched',
    });
    res.locals.errorCode = 'INTERNAL_ERROR';
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  };
}
