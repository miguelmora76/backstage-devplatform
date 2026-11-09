import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { GuardrailsClient } from './api/client';
import type { DemoSession } from './api/demoSession';
import type { DemoUser } from './api/types';

const GuardrailsContext = createContext<GuardrailsClient | undefined>(
  undefined,
);

/**
 * Hands the plugin's two seams (API and session) to the screens. The entity
 * page wrapper reads them from Backstage's API registry; tests pass a client
 * built on the stand-in backend.
 */
export function GuardrailsProvider({
  client,
  children,
}: {
  client: GuardrailsClient;
  children: ReactNode;
}) {
  return (
    <GuardrailsContext.Provider value={client}>
      {children}
    </GuardrailsContext.Provider>
  );
}

export function useGuardrails(): GuardrailsClient {
  const client = useContext(GuardrailsContext);
  if (!client) {
    throw new Error('useGuardrails must be used inside a GuardrailsProvider');
  }
  return client;
}

const versions = new WeakMap<object, { value: number }>();

/**
 * A number that changes whenever the chosen demo user changes. Sections use it
 * as a dependency so every section and the open change reload after a switch
 * (BR5.4).
 */
export function useSessionVersion(): number {
  const { session } = useGuardrails();
  let version = versions.get(session);
  if (!version) {
    version = { value: 0 };
    versions.set(session, version);
    session.subscribe(() => {
      version!.value += 1;
    });
  }
  const v = version;
  return useSyncExternalStore(
    listener => session.subscribe(listener),
    () => v.value,
  );
}

/**
 * The demo users, or undefined while the setup runs or when the demo sign-in
 * is off. The switch and the Actor filter use it (BR5.1, BR4.2).
 */
export function useDemoUsers(): DemoUser[] | undefined {
  const { session } = useGuardrails();
  return useUsersOf(session);
}

function useUsersOf(session: DemoSession | undefined): DemoUser[] | undefined {
  const [users, setUsers] = useState<DemoUser[] | undefined>(() =>
    session?.users(),
  );
  useEffect(() => {
    let live = true;
    session?.ready.then(() => {
      if (live) setUsers(session.users());
    });
    return () => {
      live = false;
    };
  }, [session]);
  return users;
}

/**
 * True when the person has a switch to choose a demo user with. A 401 text
 * that says "Choose a demo user" is only right in that case; it is also true
 * outside a provider, where nothing says otherwise.
 */
export function useCanSwitch(): boolean {
  const client = useContext(GuardrailsContext);
  const users = useUsersOf(client?.session);
  return client === undefined ? true : (users?.length ?? 0) > 0;
}
