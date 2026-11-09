import { mockServices } from '@backstage/backend-test-utils';
import { DemoSession } from '../../api/demoSession';
import { ok } from '../../api/failures';
// The sign-in module is delivered by u2 (contract C3). C1 does not describe
// the start response, so this test runs u2's own handler and checks that the
// plugin reads the token where u2 writes it (security design S1).
import { registerDemoSignIn } from '../../../../plugin-guardrails-backend/src/auth/demoSignIn';

type StartHandler = (
  req: { query: Record<string, unknown> },
  res: { status: (n: number) => unknown; json: (body: unknown) => void },
) => Promise<void>;

async function realStartAnswer(userId: string, token: string) {
  const registerProvider = jest.fn();
  registerDemoSignIn({
    enabled: true,
    providers: { registerProvider },
    logger: mockServices.logger.mock(),
  });
  const options = registerProvider.mock.calls[0][0] as {
    factory: (ctx: unknown) => { start: StartHandler };
  };
  const handlers = options.factory({
    resolverContext: { issueToken: async () => ({ token }) },
  });
  let body: unknown;
  await handlers.start(
    { query: { userId } },
    { status: () => undefined, json: b => (body = b) },
  );
  return body;
}

describe("the plugin reads the token where u2's sign-in module writes it (C3)", () => {
  it('gets the token at backstageIdentity.token from the real start handler', async () => {
    const body = await realStartAnswer('priya', 'issued-by-u2');
    const session = new DemoSession({
      discoveryApi: { getBaseUrl: async () => 'http://backend.test/api/auth' },
      fetchApi: {
        fetch: async () =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      },
      storage: undefined,
    });
    session.setUsersLoader(async () =>
      ok([{ userId: 'priya', name: 'Priya', role: 'platform-engineer' }]),
    );
    await session.ready;
    expect(await session.select('priya')).toBe(true);
    expect(await session.getToken()).toBe('issued-by-u2');
  });
});
