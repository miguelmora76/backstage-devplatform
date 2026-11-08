import type { HttpAuthService } from '@backstage/backend-plugin-api';
import type { NextFunction, Request, Response } from 'express';
import { GuardrailsError } from '../errors';
import { demoUserFromEntityRef, type DemoUser } from '../identity/demoUsers';

/** The signed-in demo user of this request (set by the identity guard). */
export function actorOf(res: Response): DemoUser {
  return res.locals.actor as DemoUser;
}

/**
 * Identity guard (BR1.1, BR1.3, NFR5.1, NFR5.2): the actor and role come only
 * from the sign-in identity. Accepts a user principal whose entity reference
 * is `user:default/<userId>` for one of the three demo users; anything else,
 * including service principals and a missing identity, is 401 with no write.
 * Nothing in the request body, query or headers is consulted.
 */
export function createIdentityGuard(httpAuth: HttpAuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const credentials = await httpAuth.credentials(req);
      const principal = credentials.principal as {
        type?: string;
        userEntityRef?: string;
      };
      const user =
        principal.type === 'user' && typeof principal.userEntityRef === 'string'
          ? demoUserFromEntityRef(principal.userEntityRef)
          : undefined;
      if (!user) {
        throw new GuardrailsError('UNAUTHENTICATED');
      }
      res.locals.actor = user;
      res.locals.actorId = user.userId;
      next();
    } catch (error) {
      next(
        error instanceof GuardrailsError
          ? error
          : new GuardrailsError('UNAUTHENTICATED'),
      );
    }
  };
}
