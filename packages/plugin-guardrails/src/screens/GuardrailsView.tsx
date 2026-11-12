import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Failure } from '../api/failures';
import { AuditLogSection } from '../components/AuditLogSection';
import { CiTriageSection } from '../components/CiTriageSection';
import { GuardrailsHeader } from '../components/GuardrailsHeader';
import { OpenChangesSection } from '../components/OpenChangesSection';
import { RefusalAlert } from '../components/RefusalAlert';
import { ResultBanner } from '../components/ResultBanner';
import { UpgradePlanSection } from '../components/UpgradePlanSection';
import { useCanSwitch } from '../context';
import { failureKey, t, type TextKey } from '../texts/texts';

/** Screen B navigates here with a banner key in the router state (BR3.3). */
export interface ViewLocationState {
  banner?: TextKey;
}

/**
 * Screen B: the Guardrails view. It lays out the header, the banner and four
 * sections, and starts every load at once (BR7.4). Each section loads on its
 * own and ends in its own state; the view only keeps the banner, the alert
 * and the flag that disables writes while a section shows the server error
 * panel (BR6.2).
 */
export function GuardrailsView({ service }: { service: string }) {
  const location = useLocation();
  const canSwitch = useCanSwitch();
  const fromDetail = (location.state as ViewLocationState | null)?.banner;
  const [banner, setBanner] = useState<TextKey | undefined>(fromDetail);
  const [alert, setAlert] = useState<TextKey | undefined>();
  const [planDown, setPlanDown] = useState(false);
  const [ciDown, setCiDown] = useState(false);
  const [versions, setVersions] = useState({
    plan: 0,
    ci: 0,
    open: 0,
    audit: 0,
  });

  useEffect(() => {
    const previous = document.title;
    document.title = t('title.view', { service });
    return () => {
      document.title = previous;
    };
  }, [service]);

  const bump = useCallback(
    (keys: Array<keyof typeof versions>) =>
      setVersions(v => {
        const next = { ...v };
        for (const k of keys) next[k] += 1;
        return next;
      }),
    [],
  );

  const onProposed = (source: 'plan' | 'ci') => () => {
    setAlert(undefined);
    setBanner('banner.proposed');
    // The proposal changes the open list, its own source row and the audit log.
    bump(['open', 'audit', source]);
  };

  const onWriteFailed = (source: 'plan' | 'ci') => (failure: Failure) => {
    setBanner(undefined);
    // A proposal for a dependency or run that no longer exists is, to the
    // person, a proposal that can no longer be made.
    const gone = failure.kind === 'api' && failure.code === 'NOT_FOUND';
    setAlert(
      gone ? 'refusal.notEligible' : failureKey(failure, 'write', canSwitch),
    );
    bump([source, 'open', 'audit']);
  };

  const onSwitched = useCallback(() => {
    setBanner(undefined);
    setAlert(undefined);
  }, []);

  const writesDisabled = planDown || ciDown;

  return (
    <div>
      <GuardrailsHeader service={service} onSwitched={onSwitched} />
      <main style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {banner && (
          <ResultBanner
            messageKey={banner}
            onDismiss={() => setBanner(undefined)}
          />
        )}
        {alert && (
          <RefusalAlert
            messageKey={alert}
            onDismiss={() => setAlert(undefined)}
          />
        )}
        <div
          data-testid="guardrails-sections"
          style={{
            display: 'grid',
            // Two columns when there is room, one when there is not; the
            // minimum is capped at the width of the container, so the grid
            // never pushes past the right edge (FR3.1).
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            gap: 16,
          }}
        >
          <UpgradePlanSection
            service={service}
            version={versions.plan}
            writesDisabled={writesDisabled}
            onServerDown={setPlanDown}
            onProposed={onProposed('plan')}
            onWriteFailed={onWriteFailed('plan')}
          />
          <CiTriageSection
            service={service}
            version={versions.ci}
            writesDisabled={writesDisabled}
            onServerDown={setCiDown}
            onProposed={onProposed('ci')}
            onWriteFailed={onWriteFailed('ci')}
          />
        </div>
        <OpenChangesSection service={service} version={versions.open} />
        <AuditLogSection service={service} version={versions.audit} />
      </main>
    </div>
  );
}
