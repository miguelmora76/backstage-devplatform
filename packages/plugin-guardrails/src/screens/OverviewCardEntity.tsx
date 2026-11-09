import { useApi, useRouteRef } from '@backstage/frontend-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { guardrailsClientApiRef } from '../api/client';
import { GuardrailsOverviewCard } from '../components/GuardrailsOverviewCard';
import { GuardrailsProvider } from '../context';
import { rootRouteRef } from '../routes';

/** The overview card on the service's overview tab (Screen A, D1). */
export function OverviewCardEntity() {
  const client = useApi(guardrailsClientApiRef);
  const { entity } = useEntity();
  const tabLink = useRouteRef(rootRouteRef);
  return (
    <GuardrailsProvider client={client}>
      <GuardrailsOverviewCard
        service={entity.metadata.name}
        to={tabLink?.() ?? 'guardrails'}
      />
    </GuardrailsProvider>
  );
}
