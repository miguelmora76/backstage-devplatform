import {
  coreServices,
  createBackendModule,
  type LoggerService,
} from '@backstage/backend-plugin-api';
import {
  authProvidersExtensionPoint,
  type AuthProvidersExtensionPoint,
} from '@backstage/plugin-auth-node';
import { entityRefFor, findDemoUser } from '../identity/demoUsers';

export interface RegisterDemoSignInOptions {
  enabled: boolean;
  providers: Pick<AuthProvidersExtensionPoint, 'registerProvider'>;
  logger: LoggerService;
}

/**
 * Registers the passwordless `demo` sign-in provider (contract C3) only when
 * `guardrails.demoSignIn.enabled` is true (NFR5.3, NFR2.6). Choosing a user
 * signs the browser in as `user:default/<userId>`. Returns whether it registered.
 */
export function registerDemoSignIn(
  options: RegisterDemoSignInOptions,
): boolean {
  if (!options.enabled) {
    return false;
  }
  options.logger.warn(
    'The demo sign-in is on: anyone who can open the page can sign in as any of the three demo users without a password. Keep guardrails.demoSignIn.enabled false outside local demos.',
  );
  options.providers.registerProvider({
    providerId: 'demo',
    factory: ({ resolverContext }) => ({
      async start(req, res) {
        const requested = req.query?.userId;
        const user =
          typeof requested === 'string' ? findDemoUser(requested) : undefined;
        if (!user) {
          res.status(401).json({
            error: {
              code: 'UNAUTHENTICATED',
              message: 'Choose one of the demo users.',
            },
          });
          return;
        }
        const ref = entityRefFor(user.userId);
        const { token } = await resolverContext.issueToken({
          claims: { sub: ref, ent: [ref] },
        });
        res.json({
          profile: { displayName: user.name },
          providerInfo: {},
          backstageIdentity: {
            token,
            identity: {
              type: 'user',
              userEntityRef: ref,
              ownershipEntityRefs: [ref],
            },
          },
        });
      },
      async frameHandler(_req, res) {
        res.status(200).end();
      },
      async logout(_req, res) {
        res.status(200).end();
      },
    }),
  });
  return true;
}

/** The backend module that adds the `demo` provider to the auth plugin. */
export const authModuleDemoSignIn = createBackendModule({
  pluginId: 'auth',
  moduleId: 'guardrails-demo-sign-in',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ providers, config, logger }) {
        registerDemoSignIn({
          enabled:
            config.getOptionalBoolean('guardrails.demoSignIn.enabled') ?? false,
          providers,
          logger,
        });
      },
    });
  },
});
