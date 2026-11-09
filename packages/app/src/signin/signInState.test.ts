import {
  initialSignInState,
  reduceSignIn,
  type DemoUser,
  type SignInEvent,
  type SignInState,
} from './signInState';

const users: DemoUser[] = [
  { userId: 'sam', name: 'Sam', role: 'service-owner' },
  { userId: 'priya', name: 'Priya', role: 'platform-engineer' },
  { userId: 'alex', name: 'Alex', role: 'auditor' },
];

const states: SignInState[] = [
  { kind: 'loading' },
  { kind: 'choosing', users },
  { kind: 'demoOff' },
  { kind: 'listFailed' },
  { kind: 'starting', users, userId: 'sam' },
  { kind: 'signInFailed', users },
  { kind: 'signedIn' },
];

const events: SignInEvent[] = [
  { type: 'listLoaded', users },
  { type: 'listOff' },
  { type: 'listFailed' },
  { type: 'retry' },
  { type: 'choose', userId: 'priya' },
  { type: 'choose', userId: 'mallory' },
  { type: 'startSucceeded' },
  { type: 'startFailed' },
  { type: 'signOut' },
];

const KINDS = new Set(states.map(state => state.kind));

describe('reduceSignIn', () => {
  it('starts in the loading state', () => {
    expect(initialSignInState).toEqual({ kind: 'loading' });
  });

  it('gives a defined state for every state and every event (NFR7.5)', () => {
    for (const state of states) {
      for (const event of events) {
        const next = reduceSignIn(state, event);
        expect(next).toBeDefined();
        expect(KINDS.has(next.kind)).toBe(true);
      }
    }
  });

  it('ends loading as choosing, demo off or list failed (BR2.2)', () => {
    const loading = initialSignInState;
    expect(reduceSignIn(loading, { type: 'listLoaded', users })).toEqual({
      kind: 'choosing',
      users,
    });
    expect(reduceSignIn(loading, { type: 'listOff' })).toEqual({
      kind: 'demoOff',
    });
    expect(reduceSignIn(loading, { type: 'listFailed' })).toEqual({
      kind: 'listFailed',
    });
    expect(reduceSignIn({ kind: 'listFailed' }, { type: 'retry' })).toEqual({
      kind: 'loading',
    });
  });

  it('starts a sign-in only for a user in the list (NFR5.7)', () => {
    const choosing: SignInState = { kind: 'choosing', users };
    expect(reduceSignIn(choosing, { type: 'choose', userId: 'priya' })).toEqual(
      { kind: 'starting', users, userId: 'priya' },
    );
    expect(reduceSignIn(choosing, { type: 'choose', userId: 'mallory' })).toBe(
      choosing,
    );
    expect(
      reduceSignIn(initialSignInState, { type: 'choose', userId: 'sam' }),
    ).toBe(initialSignInState);
  });

  it('ignores a second choice while a sign-in is starting (NFR1.2)', () => {
    const starting: SignInState = { kind: 'starting', users, userId: 'sam' };
    expect(reduceSignIn(starting, { type: 'choose', userId: 'priya' })).toBe(
      starting,
    );
  });

  it('ends starting as signed in or sign-in failed, and lets the person try again (BR2.3)', () => {
    const starting: SignInState = { kind: 'starting', users, userId: 'sam' };
    expect(reduceSignIn(starting, { type: 'startSucceeded' })).toEqual({
      kind: 'signedIn',
    });
    const failed = reduceSignIn(starting, { type: 'startFailed' });
    expect(failed).toEqual({ kind: 'signInFailed', users });
    expect(reduceSignIn(failed, { type: 'choose', userId: 'alex' })).toEqual({
      kind: 'starting',
      users,
      userId: 'alex',
    });
  });

  it('returns to loading on sign out (BR2.5)', () => {
    expect(reduceSignIn({ kind: 'signedIn' }, { type: 'signOut' })).toEqual({
      kind: 'loading',
    });
  });
});
