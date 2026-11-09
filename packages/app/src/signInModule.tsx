import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AppRootElementBlueprint,
  createFrontendModule,
  discoveryApiRef,
  PageBlueprint,
  useApi,
} from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import { CatalogA11yFix } from './a11y/CatalogA11yFix';
import { SignInPage, type SignInPageProps } from './signin/SignInPage';
import { createSignInClient } from './signin/signInClient';

/**
 * The sign-in page with its client built from Backstage's discovery service,
 * so no address is written in the app (NFR5.4). The sign-in page runs before
 * anyone is signed in, so the plain browser `fetch` is used (the framework's
 * fetch API would ask for credentials that do not exist yet).
 */
export function SignInPageWithApis(props: Omit<SignInPageProps, 'client'>) {
  const discovery = useApi(discoveryApiRef);
  const client = useMemo(
    () =>
      createSignInClient({
        discovery,
        fetchFn: (input, init) => fetch(input, init),
      }),
    [discovery],
  );
  return <SignInPage {...props} client={client} />;
}

/** The app has no home page of its own: the root goes to the catalog (D1). */
export function HomeRedirect() {
  return <Navigate to="/catalog" replace />;
}

/**
 * Puts the demo sign-in page (BR2.2) and the root redirect into the app
 * plugin, plus the small accessibility repair of the catalog list (approved
 * edit of u5). The only things the app adds to Backstage's own pages.
 */
export const signInModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    SignInPageBlueprint.make({
      params: { loader: async () => SignInPageWithApis },
    }),
    PageBlueprint.make({
      name: 'home-redirect',
      params: { path: '/', loader: async () => <HomeRedirect /> },
    }),
    AppRootElementBlueprint.make({
      name: 'catalog-a11y-fix',
      params: { element: <CatalogA11yFix /> },
    }),
  ],
});
