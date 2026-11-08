import {
  DEMO_USERS,
  demoUserFromEntityRef,
  entityRefFor,
  findDemoUser,
} from './demoUsers';

describe('demo users', () => {
  it('has exactly three users with fixed roles', () => {
    expect(DEMO_USERS).toEqual([
      { userId: 'sam', name: 'Sam', role: 'service-owner' },
      { userId: 'priya', name: 'Priya', role: 'platform-engineer' },
      { userId: 'alex', name: 'Alex', role: 'auditor' },
    ]);
  });

  it('finds a user by id and nothing for other ids', () => {
    expect(findDemoUser('priya')?.role).toBe('platform-engineer');
    expect(findDemoUser('guest')).toBeUndefined();
    expect(findDemoUser('')).toBeUndefined();
    expect(findDemoUser('constructor')).toBeUndefined();
  });

  it('maps user:default/<userId> to a demo user', () => {
    expect(entityRefFor('sam')).toBe('user:default/sam');
    expect(demoUserFromEntityRef('user:default/alex')?.role).toBe('auditor');
  });

  it('refuses entity references that do not name one of the three users', () => {
    for (const ref of [
      'user:default/guest',
      'user:other/sam',
      'group:default/sam',
      'service:default/sam',
      'user:default/SAM',
      'user:default/sam/extra',
      'sam',
      '',
    ]) {
      expect(demoUserFromEntityRef(ref)).toBeUndefined();
    }
  });
});
