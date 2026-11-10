import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Byte comparison of the upgrade plan of one seeded service before and after
 * the second fresh start (NFR7.3). A missing or empty side fails.
 */
export function comparePlans(
  first: string | Buffer | undefined,
  second: string | Buffer | undefined,
): string[] {
  const a = first === undefined ? undefined : Buffer.from(first);
  const b = second === undefined ? undefined : Buffer.from(second);
  if (!a || a.length === 0) {
    return ['NFR7.3: the first plan is missing or empty.'];
  }
  if (!b || b.length === 0) {
    return ['NFR7.3: the second plan is missing or empty.'];
  }
  return a.equals(b)
    ? []
    : [
        `NFR7.3: the two plans differ (${a.length} and ${b.length} bytes); a fresh start must give the same plan for the same seed.`,
      ];
}

/** The service whose plan the second-fresh-start check compares. */
export const PLAN_SERVICE = 'checkout-bridge';
export const PLAN_BASE_URL = 'http://localhost:7007';

/** `yarn e2e plan-snapshot <file>`: saves the plan of the sample service as bytes. */
export async function snapshotPlan(
  file: string,
  fetchFn: typeof fetch,
  log: (message: string) => void,
): Promise<void> {
  const bytes = await fetchPlan(fetchFn, PLAN_BASE_URL, PLAN_SERVICE);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  log(`Saved the plan of ${PLAN_SERVICE} (${bytes.length} bytes) to ${file}.`);
}

/** `yarn e2e plan-compare <first> <second>`: fails unless the files hold the same bytes. */
export function comparePlanFiles(
  first: string,
  second: string,
  log: (message: string) => void,
): void {
  const read = (file: string) =>
    existsSync(file) ? readFileSync(file) : undefined;
  const problems = comparePlans(read(first), read(second));
  if (problems.length > 0) throw new Error(problems.join('\n'));
  log('The two fresh starts gave the same plan, byte for byte.');
}

/**
 * Reads the plan of one service as the bytes of the response, through the real
 * demo sign-in as Sam. The token stays in memory and is never put in a message.
 */
export async function fetchPlan(
  fetchFn: typeof fetch,
  baseUrl: string,
  service: string,
): Promise<Buffer> {
  const signIn = await fetchFn(`${baseUrl}/api/auth/demo/start?userId=sam`);
  if (!signIn.ok) {
    throw new Error(`Sign-in as sam failed with status ${signIn.status}.`);
  }
  const body = (await signIn.json()) as {
    backstageIdentity?: { token?: unknown };
  } | null;
  const token = body?.backstageIdentity?.token;
  if (typeof token !== 'string' || token === '') {
    throw new Error('Sign-in as sam gave no token.');
  }
  const plan = await fetchFn(
    `${baseUrl}/api/guardrails/services/${service}/plan`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!plan.ok) {
    throw new Error(
      `Reading the plan of ${service} failed with status ${plan.status}.`,
    );
  }
  return Buffer.from(await plan.arrayBuffer());
}
