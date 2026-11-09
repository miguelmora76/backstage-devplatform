import type { APIRequestContext } from '@playwright/test';

/** The three demo users of the sample (u2 sign-in): id, name and role. */
export const USERS = {
  sam: { id: 'sam', name: 'Sam', role: 'service-owner' },
  priya: { id: 'priya', name: 'Priya', role: 'platform-engineer' },
  alex: { id: 'alex', name: 'Alex', role: 'auditor' },
} as const;

export type UserKey = keyof typeof USERS;

/** The six seeded services (the committed catalog and the default data set). */
export const SERVICES = [
  'catalog-portal',
  'checkout-bridge',
  'inventory-bridge',
  'notify-console',
  'profile-sync',
  'profile-worker',
] as const;

export const GUARDRAILS = '/api/guardrails';

/**
 * Signs in through the real demo sign-in and returns the token. Tokens are
 * kept in memory only and never written anywhere (NFR5.10).
 */
export async function signIn(
  request: APIRequestContext,
  user: UserKey,
): Promise<string> {
  const response = await request.get(
    `/api/auth/demo/start?userId=${encodeURIComponent(USERS[user].id)}`,
  );
  if (!response.ok()) {
    throw new Error(
      `Sign-in as ${user} failed with status ${response.status()}`,
    );
  }
  const body = await response.json();
  const token = body?.backstageIdentity?.token;
  if (typeof token !== 'string' || token === '') {
    throw new Error(`Sign-in as ${user} gave no token`);
  }
  return token;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface Change {
  id: string;
  status: string;
  kind: string;
  target: string;
  title?: string;
}

/** A thin client over the plugin routes, for set-up and for plain HTTP checks. */
export function client(request: APIRequestContext, token: string) {
  const headers = bearer(token);
  return {
    async plan(service: string) {
      const response = await request.get(
        `${GUARDRAILS}/services/${service}/plan`,
        { headers },
      );
      return {
        status: response.status(),
        body: await response.json().catch(() => undefined),
      };
    },
    async ciRuns(service: string) {
      const response = await request.get(
        `${GUARDRAILS}/services/${service}/ci-runs`,
        { headers },
      );
      return {
        status: response.status(),
        body: await response.json().catch(() => undefined),
      };
    },
    async changes(service: string, status = 'open') {
      const response = await request.get(
        `${GUARDRAILS}/services/${service}/changes?status=${status}`,
        { headers },
      );
      return {
        status: response.status(),
        body: await response.json().catch(() => undefined),
      };
    },
    async propose(service: string, kind: 'upgrade' | 'rerun', target: string) {
      const response = await request.post(
        `${GUARDRAILS}/services/${service}/changes`,
        {
          headers,
          data: { kind, target },
        },
      );
      return {
        status: response.status(),
        body: await response.json().catch(() => undefined),
      };
    },
    async decide(
      id: string,
      action: 'approve' | 'reject' | 'retry',
      reason: string,
    ) {
      const response = await request.post(
        `${GUARDRAILS}/changes/${id}/${action}`,
        {
          headers,
          data: { reason },
        },
      );
      return {
        status: response.status(),
        body: await response.json().catch(() => undefined),
      };
    },
    async audit(service: string, query = '') {
      const response = await request.get(
        `${GUARDRAILS}/services/${service}/audit${query}`,
        { headers },
      );
      return {
        status: response.status(),
        body: await response.json().catch(() => undefined),
      };
    },
  };
}
