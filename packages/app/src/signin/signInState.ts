/** One of the three demo users, as the backend's open list gives it. */
export interface DemoUser {
  userId: string;
  name: string;
  role: string;
}

/** Every state the sign-in page can be in (functional spec, sign-in state machine). */
export type SignInState =
  | { kind: 'loading' }
  | { kind: 'choosing'; users: DemoUser[] }
  | { kind: 'demoOff' }
  | { kind: 'listFailed' }
  | { kind: 'starting'; users: DemoUser[]; userId: string }
  | { kind: 'signInFailed'; users: DemoUser[] }
  | { kind: 'signedIn' };

export type SignInEvent =
  | { type: 'listLoaded'; users: DemoUser[] }
  | { type: 'listOff' }
  | { type: 'listFailed' }
  | { type: 'retry' }
  | { type: 'choose'; userId: string }
  | { type: 'startSucceeded' }
  | { type: 'startFailed' }
  | { type: 'signOut' };

export const initialSignInState: SignInState = { kind: 'loading' };

/**
 * The whole behavior of the sign-in page as one pure function (reliability
 * design R5). An event that does not fit the current state leaves it as it is,
 * so the page is always in one defined state and never blank. A user id that is
 * not in the list is ignored (NFR5.7), and a second choice while one is
 * starting changes nothing (NFR1.2).
 */
export function reduceSignIn(
  state: SignInState,
  event: SignInEvent,
): SignInState {
  switch (event.type) {
    case 'listLoaded':
      return state.kind === 'loading'
        ? { kind: 'choosing', users: event.users }
        : state;
    case 'listOff':
      return state.kind === 'loading' ? { kind: 'demoOff' } : state;
    case 'listFailed':
      return state.kind === 'loading' ? { kind: 'listFailed' } : state;
    case 'retry':
      return state.kind === 'listFailed' ? { kind: 'loading' } : state;
    case 'choose': {
      if (state.kind !== 'choosing' && state.kind !== 'signInFailed') {
        return state;
      }
      const listed = state.users.some(user => user.userId === event.userId);
      return listed
        ? { kind: 'starting', users: state.users, userId: event.userId }
        : state;
    }
    case 'startSucceeded':
      return state.kind === 'starting' ? { kind: 'signedIn' } : state;
    case 'startFailed':
      return state.kind === 'starting'
        ? { kind: 'signInFailed', users: state.users }
        : state;
    case 'signOut':
      return state.kind === 'signedIn' ? { kind: 'loading' } : state;
    default:
      return state;
  }
}
