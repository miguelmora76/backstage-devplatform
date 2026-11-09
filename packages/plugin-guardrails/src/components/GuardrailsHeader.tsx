import { useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Typography from '@material-ui/core/Typography';
import { useDemoUsers, useGuardrails, useSessionVersion } from '../context';
import { useSection } from '../hooks/useSection';
import { t } from '../texts/texts';
import { DemoUserSwitch } from './DemoUserSwitch';
import { ShieldMark } from './ShieldMark';

export interface GuardrailsHeaderProps {
  service: string;
  /** On Screen C: the change title becomes the h1 and the crumbs show the way back. */
  changeTitle?: string;
  onSwitched: () => void;
}

/**
 * The header of Screens B and C: shield mark, breadcrumbs, the signed-in user
 * and the demo-user switch (BR5.1). The h1 is the service name on Screen B and
 * the change title on Screen C (D10).
 */
export function GuardrailsHeader({
  service,
  changeTitle,
  onSwitched,
}: GuardrailsHeaderProps) {
  const { api } = useGuardrails();
  const sessionVersion = useSessionVersion();
  const users = useDemoUsers();
  const me = useSection(signal => api.me({ signal }), [api, sessionVersion], {
    isEmpty: () => false,
  });
  // Keep the last known name so the switch button stays mounted (and keeps
  // focus) while the user is read again after a switch.
  const lastName = useRef<string | undefined>();
  if (me.state.status === 'loaded') {
    lastName.current = me.state.data.name;
  }
  const name = lastName.current;

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '8px 0',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
      >
        <ShieldMark />
        {changeTitle === undefined ? (
          <>
            <Typography component="span" variant="h6">
              {t('label.guardrails')} &gt;
            </Typography>
            <Typography variant="h5" component="h1">
              {service}
            </Typography>
          </>
        ) : (
          <div>
            <nav aria-label="Breadcrumb">
              <Typography variant="body2" component="span">
                <RouterLink to="..">{t('label.guardrails')}</RouterLink> &gt;{' '}
                <RouterLink to="..">{service}</RouterLink> &gt;{' '}
                {t('text.change')}
              </Typography>
            </nav>
            <Typography
              variant="h5"
              component="h1"
              tabIndex={-1}
              data-testid="detail-h1"
            >
              {changeTitle}
            </Typography>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {name !== undefined && (
          <Typography variant="body2" data-testid="signed-in">
            {t('text.signedInAs', { name })}
          </Typography>
        )}
        {name !== undefined && users !== undefined && users.length > 0 && (
          <DemoUserSwitch
            users={users}
            currentName={name}
            onSwitched={onSwitched}
          />
        )}
      </div>
    </header>
  );
}
