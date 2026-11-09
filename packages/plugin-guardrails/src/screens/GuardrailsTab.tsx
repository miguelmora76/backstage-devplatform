import { useApi } from '@backstage/frontend-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { guardrailsClientApiRef } from '../api/client';
import { GuardrailsProvider } from '../context';
import { GuardrailsRoutes } from './GuardrailsRoutes';

/**
 * The content of the "Guardrails" tab on the service page (D1). The service
 * name used in every call is the catalog entity name.
 */
export function GuardrailsTab() {
  const client = useApi(guardrailsClientApiRef);
  const { entity } = useEntity();
  return (
    <GuardrailsProvider client={client}>
      <GuardrailsRoutes service={entity.metadata.name} />
    </GuardrailsProvider>
  );
}
