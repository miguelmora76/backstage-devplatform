/** The texts of the sign-in page (functional spec, "Strings of the Sign-In Page"). */
export const signInStrings = {
  title: 'Choose a demo user',
  intro:
    'This sample has three invented users. Pick one to sign in; no password is needed.',
  off: 'The demo sign-in is off, so nobody can sign in. Ask whoever runs this app to turn it on.',
  loadFailed: 'Could not load the demo users.',
  retry: 'Retry',
  failed: 'Could not sign in. Try again.',
  loading: 'Loading demo users...',
  working: 'Working...',
  action: 'Sign in',
  choose: (name: string) => `Sign in as ${name}`,
} as const;

const ROLE_LABELS: Record<string, string> = {
  'service-owner': 'Service owner',
  'platform-engineer': 'Platform engineer',
  auditor: 'Auditor',
};

/** The label of a role; a role this page does not know is shown as the backend wrote it. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
