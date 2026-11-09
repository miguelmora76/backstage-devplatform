import { expect, test } from '@playwright/test';
import { GUARDRAILS, USERS, bearer, signIn, type UserKey } from './support/api';
import { seededDependencies } from './support/seed';

// NFR5.6: the backend accepts browser calls only from the app's own address
// and sends a content policy. NFR5.7: a token from the real sign-in works on
// the real plugin backend; a call without one, a malformed one or one with a
// changed character is refused with 401. Plain HTTP, no browser.
const APP = 'http://localhost:7007';
const SERVICE = 'checkout-bridge';

test.describe('origin and content policy (NFR5.6)', () => {
  test('allows the app origin and no other', async ({ request }) => {
    const own = await request.get(`${GUARDRAILS}/demo-users`, {
      headers: { Origin: APP },
    });
    expect(own.headers()['access-control-allow-origin']).toBe(APP);

    const foreign = await request.get(`${GUARDRAILS}/demo-users`, {
      headers: { Origin: 'https://example.org' },
    });
    expect(foreign.headers()['access-control-allow-origin']).toBeUndefined();
  });

  test('sends a content policy with self and unsafe-eval for scripts, and no wildcard', async ({
    request,
  }) => {
    const page = await request.get('/');
    expect(page.ok()).toBe(true);
    const policy = page.headers()['content-security-policy'];
    expect(policy).toBeDefined();
    const script = policy
      .split(';')
      .map(part => part.trim())
      .find(part => part.startsWith('script-src'));
    expect(script).toContain("'self'");
    expect(script).toContain("'unsafe-eval'");
    expect(policy.split(/[\s;]+/)).not.toContain('*');
  });
});

test.describe('token step (NFR5.7)', () => {
  for (const user of Object.keys(USERS) as UserKey[]) {
    test(`a token from the sign-in of ${user} reads the seeded plan`, async ({
      request,
    }) => {
      const token = await signIn(request, user);
      const response = await request.get(
        `${GUARDRAILS}/services/${SERVICE}/plan`,
        { headers: bearer(token) },
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      const names = (body.items as Array<{ name: string }>)
        .map(i => i.name)
        .sort();
      expect(names).toEqual(
        seededDependencies(SERVICE)
          .map(d => d.name)
          .sort(),
      );
    });
  }

  test('refuses no token, a malformed token and a token with one changed character', async ({
    request,
  }) => {
    const token = await signIn(request, 'sam');
    const middle = Math.floor(token.length / 2);
    const changed =
      token.slice(0, middle) +
      (token[middle] === 'A' ? 'B' : 'A') +
      token.slice(middle + 1);
    const url = `${GUARDRAILS}/services/${SERVICE}/plan`;

    expect((await request.get(url)).status()).toBe(401);
    expect(
      (await request.get(url, { headers: bearer('not-a-token') })).status(),
    ).toBe(401);
    expect(
      (await request.get(url, { headers: bearer(changed) })).status(),
    ).toBe(401);
  });
});
