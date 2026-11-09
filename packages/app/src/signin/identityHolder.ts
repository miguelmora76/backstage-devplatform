import type {
  IdentityApi,
  ProfileInfo,
  BackstageUserIdentity,
} from '@backstage/frontend-plugin-api';
import type { StartAnswer } from './signInClient';

/**
 * Holds the identity and token of the signed-in demo user in memory and hands
 * it to the framework through the identity API's own methods (security design
 * S3). There is no getter that returns the token to the page, no storage, no
 * log call and no address built from it; a reload forgets everything (BR2.6).
 */
export function createIdentityHolder(
  answer: StartAnswer,
  onSignOut: () => void = () => undefined,
): IdentityApi {
  // A private copy, so later changes to the answer cannot reach the holder.
  const kept: { value: StartAnswer | undefined } = {
    value: JSON.parse(JSON.stringify(answer)) as StartAnswer,
  };

  return {
    async getProfileInfo(): Promise<ProfileInfo> {
      return kept.value ? { ...kept.value.profile } : {};
    },
    async getBackstageIdentity(): Promise<BackstageUserIdentity> {
      if (!kept.value) {
        throw new Error('The demo user is signed out.');
      }
      return { ...kept.value.backstageIdentity.identity };
    },
    async getCredentials() {
      return kept.value ? { token: kept.value.backstageIdentity.token } : {};
    },
    async signOut() {
      kept.value = undefined;
      onSignOut();
    },
  };
}
