import type { APIRequestContext } from '@playwright/test';
import { client, signIn } from './api';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Waits, with a bound, until the whole stack answers the way the browser
 * specs need: the app's readiness route is 200 and a real plugin read (a
 * seeded plan, which goes through the guardrails server) is 200. A container
 * that Docker calls healthy is not enough after the server was killed: the
 * plugin backend keeps a health result for 5 seconds and its connection may
 * still be the old one. A failure says what the last answer was.
 */
export async function waitForHealthyStack(
  request: APIRequestContext,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = 'no answer yet';
  while (Date.now() < deadline) {
    try {
      const ready = await request.get('/.backstage/health/v1/readiness');
      if (ready.ok()) {
        const plan = await client(request, await signIn(request, 'sam')).plan(
          'checkout-bridge',
        );
        if (plan.status === 200) return;
        last = `plan read answered HTTP ${plan.status} ${JSON.stringify(plan.body)}`;
      } else {
        last = `readiness answered HTTP ${ready.status()}`;
      }
    } catch (error) {
      last = String(error);
    }
    await sleep(1000);
  }
  throw new Error(
    `The stack was not healthy within ${timeoutMs / 1000} seconds (${last}).`,
  );
}
