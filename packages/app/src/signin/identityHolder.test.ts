import { createIdentityHolder } from './identityHolder';
import type { StartAnswer } from './signInClient';

const answer: StartAnswer = {
  profile: { displayName: 'Priya' },
  providerInfo: {},
  backstageIdentity: {
    token: 'fake-token-priya',
    identity: {
      type: 'user',
      userEntityRef: 'user:default/priya',
      ownershipEntityRefs: ['user:default/priya'],
    },
  },
};

describe('IdentityHolder', () => {
  it('hands out the profile, the identity and the credentials through the identity API (BR2.3)', async () => {
    const holder = createIdentityHolder(answer);
    await expect(holder.getProfileInfo()).resolves.toEqual({
      displayName: 'Priya',
    });
    await expect(holder.getBackstageIdentity()).resolves.toEqual(
      answer.backstageIdentity.identity,
    );
    await expect(holder.getCredentials()).resolves.toEqual({
      token: 'fake-token-priya',
    });
  });

  it('has only the four identity methods and no getter for the token (NFR5.3)', () => {
    const holder = createIdentityHolder(answer);
    expect(Object.keys(holder).sort()).toEqual([
      'getBackstageIdentity',
      'getCredentials',
      'getProfileInfo',
      'signOut',
    ]);
    expect(JSON.stringify(holder)).not.toContain('fake-token-priya');
    expect(String(holder)).not.toContain('fake-token-priya');
  });

  it('writes nothing to browser storage (NFR5.3, BR2.6)', async () => {
    const holder = createIdentityHolder(answer);
    await holder.getCredentials();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it('forgets everything on sign out and tells the page (BR2.5)', async () => {
    const onSignOut = jest.fn();
    const holder = createIdentityHolder(answer, onSignOut);
    await holder.signOut();
    expect(onSignOut).toHaveBeenCalledTimes(1);
    await expect(holder.getCredentials()).resolves.toEqual({});
    await expect(holder.getBackstageIdentity()).rejects.toThrow(/signed out/i);
    await expect(holder.getProfileInfo()).resolves.toEqual({});
  });

  it('does not keep a changed copy: later changes to the answer do not reach the holder', async () => {
    const copy: StartAnswer = JSON.parse(JSON.stringify(answer));
    const holder = createIdentityHolder(copy);
    copy.backstageIdentity.token = 'changed';
    await expect(holder.getCredentials()).resolves.toEqual({
      token: 'fake-token-priya',
    });
  });
});
