import { Route, Routes, useParams } from 'react-router-dom';
import { GuardrailsView } from './GuardrailsView';
import { ChangeDetailScreen } from './ChangeDetailScreen';

function DetailRoute({ service }: { service: string }) {
  const { changeId = '' } = useParams();
  return <ChangeDetailScreen service={service} changeId={changeId} />;
}

/**
 * The routes inside the Guardrails tab (D1): the view at the tab's own path
 * and the change detail at `changes/:changeId`.
 */
export function GuardrailsRoutes({ service }: { service: string }) {
  return (
    <Routes>
      <Route index element={<GuardrailsView service={service} />} />
      <Route
        path="changes/:changeId"
        element={<DetailRoute service={service} />}
      />
      <Route path="*" element={<GuardrailsView service={service} />} />
    </Routes>
  );
}
