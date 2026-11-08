import type { Role } from '../store/types';

export interface DemoUser {
  userId: string;
  name: string;
  role: Role;
}

/** The three fixed demo users and their roles (BR1.2, NFR7.1). */
export const DEMO_USERS: readonly DemoUser[] = Object.freeze([
  { userId: 'sam', name: 'Sam', role: 'service-owner' },
  { userId: 'priya', name: 'Priya', role: 'platform-engineer' },
  { userId: 'alex', name: 'Alex', role: 'auditor' },
]);

const ENTITY_REF_PREFIX = 'user:default/';

export function findDemoUser(userId: string): DemoUser | undefined {
  return DEMO_USERS.find(user => user.userId === userId);
}

export function entityRefFor(userId: string): string {
  return `${ENTITY_REF_PREFIX}${userId}`;
}

/** Accepts only `user:default/<userId>` for one of the three users (NFR5.2). */
export function demoUserFromEntityRef(ref: string): DemoUser | undefined {
  if (!ref.startsWith(ENTITY_REF_PREFIX)) {
    return undefined;
  }
  return findDemoUser(ref.slice(ENTITY_REF_PREFIX.length));
}
