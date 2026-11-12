import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { SignInPage } from './SignInPage';
import type { ListResult, SignInClient, StartAnswer } from './signInClient';
import type { DemoUser } from './signInState';
import { roleLabel } from './strings';

const users: DemoUser[] = [
  { userId: 'sam', name: 'Sam', role: 'service-owner' },
  { userId: 'priya', name: 'Priya', role: 'platform-engineer' },
  { userId: 'alex', name: 'Alex', role: 'auditor' },
];

const answer = (userId: string): StartAnswer => ({
  profile: { displayName: userId },
  providerInfo: {},
  backstageIdentity: {
    token: `fake-token-${userId}`,
    identity: {
      type: 'user',
      userEntityRef: `user:default/${userId}`,
      ownershipEntityRefs: [`user:default/${userId}`],
    },
  },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function makeClient(overrides: Partial<SignInClient> = {}): SignInClient {
  return {
    listUsers: jest.fn(async (): Promise<ListResult> => ({
      status: 'ok',
      users,
    })),
    start: jest.fn(async (userId: string) => answer(userId)),
    ...overrides,
  };
}

function setup(client: SignInClient) {
  const onSignInSuccess = jest.fn();
  const view = render(
    <SignInPage client={client} onSignInSuccess={onSignInSuccess} />,
  );
  return { onSignInSuccess, ...view };
}

describe('SignInPage', () => {
  it('shows the loading text while the list is read, then the three demo users with their roles (BR2.2)', async () => {
    const list = deferred<ListResult>();
    setup(makeClient({ listUsers: () => list.promise }));
    expect(screen.getByText('Loading demo users...')).toBeInTheDocument();

    await act(async () => list.resolve({ status: 'ok', users }));
    expect(
      screen.getByRole('heading', { name: 'Choose a demo user' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This sample has three invented users. Pick one to sign in; no password is needed.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('Service owner')).toBeInTheDocument();
    expect(screen.getByText('Platform engineer')).toBeInTheDocument();
    expect(screen.getByText('Auditor')).toBeInTheDocument();
    for (const name of ['Sam', 'Priya', 'Alex']) {
      expect(
        screen.getByRole('button', { name: `Sign in as ${name}` }),
      ).toBeInTheDocument();
    }
  });

  it('signs in as the chosen user and hands the identity to the app (BR2.3, AC5.1.1)', async () => {
    const client = makeClient();
    const { onSignInSuccess } = setup(client);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sign in as Priya' }),
    );
    await waitFor(() => expect(onSignInSuccess).toHaveBeenCalledTimes(1));
    expect(client.start).toHaveBeenCalledWith('priya');
    const identity = onSignInSuccess.mock.calls[0][0];
    await expect(identity.getCredentials()).resolves.toEqual({
      token: 'fake-token-priya',
    });
    await expect(identity.getBackstageIdentity()).resolves.toMatchObject({
      userEntityRef: 'user:default/priya',
    });
  });

  it('shows a working state at once and sends one request for two activations (NFR1.2)', async () => {
    const start = deferred<StartAnswer | undefined>();
    const client = makeClient({ start: jest.fn(() => start.promise) });
    const { onSignInSuccess } = setup(client);
    const sam = await screen.findByRole('button', { name: 'Sign in as Sam' });

    await act(async () => {
      sam.click();
      sam.click();
    });
    expect(client.start).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Working...').length).toBeGreaterThan(0);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }

    await act(async () => start.resolve(answer('sam')));
    await waitFor(() => expect(onSignInSuccess).toHaveBeenCalledTimes(1));
  });

  it('shows the demo-off text and no way to sign in when the list is not open (BR2.2)', async () => {
    setup(makeClient({ listUsers: async () => ({ status: 'off' }) }));
    expect(
      await screen.findByText(
        'The demo sign-in is off, so nobody can sign in. Ask whoever runs this app to turn it on.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows a text with Retry when the list cannot be read, and Retry loads it again (BR2.2)', async () => {
    const listUsers = jest
      .fn<Promise<ListResult>, []>()
      .mockResolvedValueOnce({ status: 'failed' })
      .mockResolvedValueOnce({ status: 'ok', users });
    setup(makeClient({ listUsers }));
    expect(
      await screen.findByText('Could not load the demo users.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('button', { name: 'Sign in as Sam' }),
    ).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('drops the answer of an older list read (performance design P2)', async () => {
    // Strict mode runs the loading effect twice, so two reads are started and
    // the first one's answer is stale and must not be shown.
    const first = deferred<ListResult>();
    const second = deferred<ListResult>();
    const listUsers = jest
      .fn<Promise<ListResult>, []>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(
      <StrictMode>
        <SignInPage
          client={makeClient({ listUsers })}
          onSignInSuccess={jest.fn()}
        />
      </StrictMode>,
    );
    expect(listUsers).toHaveBeenCalledTimes(2);
    await act(async () => second.resolve({ status: 'ok', users }));
    await act(async () => first.resolve({ status: 'ok', users: [users[0]] }));
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('stays on the page with the failure text and lets the person try again (BR2.3)', async () => {
    const start = jest
      .fn<Promise<StartAnswer | undefined>, [string]>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(answer('alex'));
    const { onSignInSuccess } = setup(makeClient({ start }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sign in as Alex' }),
    );
    expect(
      await screen.findByText('Could not sign in. Try again.'),
    ).toBeInTheDocument();
    expect(onSignInSuccess).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Sign in as Alex' }),
    );
    await waitFor(() => expect(onSignInSuccess).toHaveBeenCalledTimes(1));
  });

  it('has no accessibility violation in any state (NFR3.1)', async () => {
    // loading
    const loading = deferred<ListResult>();
    const first = setup(makeClient({ listUsers: () => loading.promise }));
    expect(await axe(first.container)).toHaveNoViolations();
    first.unmount();

    // choosing
    const choosing = setup(makeClient());
    await screen.findByRole('button', { name: 'Sign in as Sam' });
    expect(await axe(choosing.container)).toHaveNoViolations();
    choosing.unmount();

    // demo off
    const off = setup(
      makeClient({ listUsers: async () => ({ status: 'off' }) }),
    );
    await screen.findByText(/The demo sign-in is off/);
    expect(await axe(off.container)).toHaveNoViolations();
    off.unmount();

    // list failed
    const failed = setup(
      makeClient({ listUsers: async () => ({ status: 'failed' }) }),
    );
    await screen.findByText('Could not load the demo users.');
    expect(await axe(failed.container)).toHaveNoViolations();
    failed.unmount();

    // starting
    const pending = deferred<StartAnswer | undefined>();
    const starting = setup(makeClient({ start: () => pending.promise }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sign in as Sam' }),
    );
    expect(await axe(starting.container)).toHaveNoViolations();
    starting.unmount();

    // sign-in failed
    const signInFailed = setup(makeClient({ start: async () => undefined }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sign in as Sam' }),
    );
    await screen.findByText('Could not sign in. Try again.');
    expect(await axe(signInFailed.container)).toHaveNoViolations();
  });

  it('is usable with the keyboard alone: Tab, Enter and Space, and Retry (NFR3.2)', async () => {
    const { onSignInSuccess } = setup(makeClient());
    await screen.findByRole('button', { name: 'Sign in as Sam' });
    await userEvent.tab();
    expect(
      screen.getByRole('button', { name: 'Sign in as Sam' }),
    ).toHaveFocus();
    await userEvent.tab();
    expect(
      screen.getByRole('button', { name: 'Sign in as Priya' }),
    ).toHaveFocus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(onSignInSuccess).toHaveBeenCalledTimes(1));

    const enter = setup(makeClient());
    await within(enter.container).findByRole('button', {
      name: 'Sign in as Sam',
    });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(enter.onSignInSuccess).toHaveBeenCalled());

    const retry = setup(
      makeClient({ listUsers: async () => ({ status: 'failed' }) }),
    );
    await within(retry.container).findByText('Could not load the demo users.');
    await userEvent.tab();
    expect(
      within(retry.container).getByRole('button', { name: 'Retry' }),
    ).toHaveFocus();
  });

  it('shows names and roles from the backend as text, never as markup (NFR5.5)', async () => {
    const hostile: DemoUser[] = [
      {
        userId: 'sam',
        name: '<img src=x onerror="document.title=1">',
        role: '<script>window.hacked=1</script>',
      },
    ];
    const { container } = setup(
      makeClient({ listUsers: async () => ({ status: 'ok', users: hostile }) }),
    );
    expect(
      await screen.findByText('<img src=x onerror="document.title=1">'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('<script>window.hacked=1</script>'),
    ).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('offers no free-text field and leaves no token in storage, console or page text (NFR5.3, NFR5.7)', async () => {
    const errors = jest.spyOn(console, 'error');
    const logs = jest.spyOn(console, 'log');
    const { onSignInSuccess, container } = setup(makeClient());
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sign in as Sam' }),
    );
    await waitFor(() => expect(onSignInSuccess).toHaveBeenCalled());
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.body.textContent).not.toContain('fake-token-sam');
    expect(JSON.stringify(logs.mock.calls)).not.toContain('fake-token-sam');
    expect(JSON.stringify(errors.mock.calls)).not.toContain('fake-token-sam');
  });
});

describe('SignInPage layout (FR3.2, FR4.1, FR4.2)', () => {
  it('puts the three users in one centred container of limited width, each name and role next to its button (FR3.2)', async () => {
    setup(makeClient());
    await screen.findByRole('button', { name: 'Sign in as Sam' });

    const container = screen.getByTestId('sign-in-container');
    const style = window.getComputedStyle(container);
    expect(style.maxWidth).toMatch(/^\d+(\.\d+)?px$/);
    expect(style.marginLeft).toBe('auto');
    expect(style.marginRight).toBe('auto');
    expect(container).toContainElement(
      screen.getByRole('list', { name: 'Choose a demo user' }),
    );

    const rows = within(container).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    for (const [index, user] of users.entries()) {
      const row = within(rows[index]);
      expect(row.getByText(user.name)).toBeInTheDocument();
      expect(row.getByText(roleLabel(user.role))).toBeInTheDocument();
      expect(
        row.getByRole('button', { name: `Sign in as ${user.name}` }),
      ).toBeInTheDocument();
    }
  });

  it('keeps every text and test hook as it was (FR4.1, FR4.2)', async () => {
    setup(makeClient());
    await screen.findByRole('button', { name: 'Sign in as Sam' });
    expect(screen.getByTestId('sign-in-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Choose a demo user' }),
    ).toBeInTheDocument();
    for (const user of users) {
      expect(
        screen.getByTestId(`sign-in-choose-${user.userId}`),
      ).toHaveAccessibleName(`Sign in as ${user.name}`);
      expect(
        screen.getByTestId(`sign-in-choose-${user.userId}`),
      ).toHaveTextContent('Sign in');
    }
  });
});
