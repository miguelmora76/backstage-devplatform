import {
  authProvidersExtensionPoint,
  type AuthProviderFactory,
} from '@backstage/plugin-auth-node';
import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { createCapturingLogger } from '../testing/harness';
import { authModuleDemoSignIn, registerDemoSignIn } from './demoSignIn';

interface MockRes {
  statusCode: number;
  body: unknown;
  status: jest.Mock;
  json: jest.Mock;
  end: jest.Mock;
}

function mockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: undefined,
    status: jest.fn(),
    json: jest.fn(),
    end: jest.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.end.mockImplementation(() => res);
  return res;
}

function register(enabled: boolean) {
  const providers = { registerProvider: jest.fn() };
  const logger = createCapturingLogger();
  registerDemoSignIn({ enabled, providers, logger });
  return { providers, logger };
}

function handlersOf(
  providers: { registerProvider: jest.Mock },
  issueToken: jest.Mock,
) {
  const options = providers.registerProvider.mock.calls[0][0] as {
    providerId: string;
    factory: AuthProviderFactory;
  };
  return options.factory({ resolverContext: { issueToken } } as never);
}

describe('demo sign-in provider', () => {
  it('registers the demo provider and warns at start-up only when the setting is on', () => {
    const on = register(true);
    expect(on.providers.registerProvider).toHaveBeenCalledTimes(1);
    expect(on.providers.registerProvider.mock.calls[0][0].providerId).toBe(
      'demo',
    );
    expect(
      on.logger.lines.some(
        l => l.startsWith('warn ') && /demo sign-in is on/i.test(l),
      ),
    ).toBe(true);

    const off = register(false);
    expect(off.providers.registerProvider).not.toHaveBeenCalled();
    expect(off.logger.lines).toEqual([]);
  });

  it('signs in as the chosen demo user with identity user:default/<userId>', async () => {
    const { providers } = register(true);
    const issueToken = jest.fn().mockResolvedValue({ token: 'issued-token' });
    const handlers = handlersOf(providers, issueToken);
    const res = mockRes();
    await handlers.start({ query: { userId: 'priya' } } as never, res as never);

    expect(issueToken).toHaveBeenCalledWith({
      claims: { sub: 'user:default/priya', ent: ['user:default/priya'] },
    });
    expect(res.body).toEqual({
      profile: { displayName: 'Priya' },
      providerInfo: {},
      backstageIdentity: {
        token: 'issued-token',
        identity: {
          type: 'user',
          userEntityRef: 'user:default/priya',
          ownershipEntityRefs: ['user:default/priya'],
        },
      },
    });
  });

  it('refuses a missing, unknown or repeated user id with 401 and issues no token', async () => {
    const { providers } = register(true);
    const issueToken = jest.fn();
    const handlers = handlersOf(providers, issueToken);
    for (const query of [
      {},
      { userId: 'guest' },
      { userId: ['sam', 'alex'] },
      { userId: 'SAM' },
    ]) {
      const res = mockRes();
      await handlers.start({ query } as never, res as never);
      expect(res.statusCode).toBe(401);
    }
    expect(issueToken).not.toHaveBeenCalled();
  });

  it('answers the frame and logout routes without issuing anything', async () => {
    const { providers } = register(true);
    const issueToken = jest.fn();
    const handlers = handlersOf(providers, issueToken);
    const res = mockRes();
    await handlers.frameHandler({} as never, res as never);
    await handlers.logout?.({} as never, res as never);
    expect(issueToken).not.toHaveBeenCalled();
  });

  it('is wired as a module of the auth plugin and reads the setting', async () => {
    const registerProvider = jest.fn();
    const backend = await startTestBackend({
      features: [
        authModuleDemoSignIn,
        mockServices.rootConfig.factory({
          data: { guardrails: { demoSignIn: { enabled: true } } },
        }),
      ],
      extensionPoints: [[authProvidersExtensionPoint, { registerProvider }]],
    });
    expect(registerProvider).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'demo' }),
    );
    await backend.stop();

    const none = jest.fn();
    const off = await startTestBackend({
      features: [authModuleDemoSignIn],
      extensionPoints: [
        [authProvidersExtensionPoint, { registerProvider: none }],
      ],
    });
    expect(none).not.toHaveBeenCalled();
    await off.stop();
  });
});
