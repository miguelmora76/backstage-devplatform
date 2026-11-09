import { useId } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { useGuardrails, useSessionVersion } from '../context';
import { useSection } from '../hooks/useSection';
import { cardCounts } from '../rules/derive';
import { t } from '../texts/texts';
import { ShieldMark } from './ShieldMark';
import { srOnly } from './srOnly';

/** Screen A: three counts and one link to the Guardrails view (BR1.4). */
export function GuardrailsOverviewCard({
  service,
  to,
}: {
  service: string;
  to: string;
}) {
  const { api } = useGuardrails();
  const sessionVersion = useSessionVersion();
  const headingId = useId();
  const deps = [api, service, sessionVersion];
  // The three reads start together when the card mounts (NFR1.3).
  const plan = useSection(s => api.plan(service, { signal: s }), deps, {
    serverErrorPanel: true,
    isEmpty: () => false,
  });
  const ci = useSection(s => api.ciRuns(service, { signal: s }), deps, {
    serverErrorPanel: true,
    isEmpty: () => false,
  });
  const open = useSection(s => api.changes(service, { signal: s }), deps, {
    isEmpty: () => false,
  });

  const states = [plan.state, ci.state, open.state];
  const loading = states.some(s => s.status === 'loading');
  const serverDown = states.some(s => s.status === 'server-error');
  const failed = states.some(s => s.status === 'load-failed');
  const retry = () => {
    plan.reload();
    ci.reload();
    open.reload();
  };

  let counts: ReturnType<typeof cardCounts> | undefined;
  if (
    plan.state.status === 'loaded' &&
    ci.state.status === 'loaded' &&
    open.state.status === 'loaded'
  ) {
    counts = cardCounts(plan.state.data, ci.state.data, open.state.data);
  }

  const rows: Array<[string, string, number | undefined]> = [
    ['upgrades', t('card.upgrades'), counts?.upgrades],
    ['failedRuns', t('card.failedRuns'), counts?.failedRuns],
    ['open', t('card.open'), counts?.open],
  ];
  const showError = !loading && (serverDown || failed);

  return (
    <Paper
      component="section"
      aria-labelledby={headingId}
      aria-busy={loading ? 'true' : 'false'}
      style={{ padding: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldMark />
        <Typography variant="h6" component="h2" id={headingId}>
          {t('card.title')}
        </Typography>
      </div>
      {loading && (
        <span role="status" style={srOnly}>
          {t('loading.card')}
        </span>
      )}
      <dl style={{ margin: '12px 0' }}>
        {rows.map(([key, label, value]) => (
          <div key={key} style={{ display: 'flex', gap: 8 }}>
            <Typography component="dt" variant="body2">
              {label}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              data-testid={`count-${key}`}
              style={{ margin: 0 }}
            >
              {loading ? t('loading.inline') : (value ?? t('text.dash'))}
            </Typography>
          </div>
        ))}
      </dl>
      {showError && (
        <div
          role="alert"
          style={{ display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <Typography variant="body2">
            {serverDown ? t('error.unreachable') : t('error.loadFailed')}
          </Typography>
          <Button size="small" variant="outlined" onClick={retry}>
            {t('label.retryLoad')}
          </Button>
        </div>
      )}
      {counts && counts.upgrades + counts.failedRuns + counts.open === 0 && (
        <Typography variant="body2">{t('empty.card')}</Typography>
      )}
      <Button
        component={RouterLink}
        to={to}
        variant="contained"
        color="primary"
        size="small"
        role="link"
      >
        {t('label.openGuardrails')}
      </Button>
    </Paper>
  );
}
