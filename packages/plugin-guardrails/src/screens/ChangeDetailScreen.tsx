import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import type { Failure } from '../api/failures';
import type { Change } from '../api/types';
import { ChangeSummary } from '../components/ChangeSummary';
import { DecisionBlock } from '../components/DecisionBlock';
import { GuardrailsHeader } from '../components/GuardrailsHeader';
import { ReasonForm, type DecisionAction } from '../components/ReasonForm';
import { RefusalAlert } from '../components/RefusalAlert';
import { SectionState } from '../components/SectionState';
import { ServerErrorPanel } from '../components/ServerErrorPanel';
import { useCanSwitch, useGuardrails, useSessionVersion } from '../context';
import { useSection } from '../hooks/useSection';
import { changeTitle } from '../rules/derive';
import { failureKey, t, type TextKey } from '../texts/texts';

/** Failures after which the change is read again, to show where it really stands. */
function shouldReload(failure: Failure): boolean {
  if (failure.kind === 'no-answer' || failure.kind === 'server-unreachable') {
    return true;
  }
  if (failure.kind === 'api') {
    return [
      'ALREADY_DECIDED',
      'NOT_FAILED',
      'CLAIM_RELEASED',
      'AUDITOR_READ_ONLY',
      'SELF_DECISION',
      'NOT_FOUND',
    ].includes(failure.code);
  }
  return false;
}

function bannerFor(action: DecisionAction, change: Change): TextKey {
  if (action === 'reject') return 'banner.rejected';
  if (action === 'approve') {
    return change.status === 'applied'
      ? 'banner.approved'
      : 'banner.applyFailed';
  }
  return change.status === 'applied'
    ? 'banner.retryApplied'
    : 'banner.retryFailed';
}

/**
 * Screen C: one change, with the reason box and the decision actions (BR3.2 to
 * BR3.8). The title is the backend's `summary` (D10). Which actions appear
 * follows the status (D11); whether each is enabled is the backend's answer.
 */
export function ChangeDetailScreen({
  service,
  changeId,
}: {
  service: string;
  changeId: string;
}) {
  const { api } = useGuardrails();
  const sessionVersion = useSessionVersion();
  const navigate = useNavigate();
  const canSwitch = useCanSwitch();
  const root = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<TextKey | undefined>();
  const [alert, setAlert] = useState<TextKey | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const section = useSection(
    signal => api.change(changeId, { signal }),
    [api, changeId, version, sessionVersion],
    { isEmpty: () => false, keepPrevious: true, serverErrorPanel: true },
  );

  // Opening the screen puts focus on its h1 (BR7.3).
  useEffect(() => {
    root.current?.querySelector('h1')?.focus();
  }, []);

  const lastChange = useRef<Change | undefined>();
  if (section.state.status === 'loaded') {
    lastChange.current = section.state.data;
  }
  const change =
    section.state.status === 'loaded' ? section.state.data : undefined;
  const title = change ? changeTitle(change) : t('text.change');

  useEffect(() => {
    const previous = document.title;
    document.title = change
      ? t('title.detail', { title, service })
      : t('title.detailLoading', { service });
    return () => {
      document.title = previous;
    };
  }, [change, title, service]);

  const submit = async (action: DecisionAction) => {
    if (reason.trim().length === 0) {
      setReasonError('error.reasonRequired');
      root.current
        ?.querySelector<HTMLTextAreaElement>('textarea[data-testid="reason"]')
        ?.focus();
      return;
    }
    setReasonError(undefined);
    setAlert(undefined);
    setSubmitting(true);
    const result = await api[action](changeId, reason);
    setSubmitting(false);
    if (result.ok) {
      navigate('..', { state: { banner: bannerFor(action, result.value) } });
      return;
    }
    const { failure } = result;
    if (failure.kind === 'api' && failure.code === 'EMPTY_REASON') {
      setReasonError('error.reasonRequired');
      return;
    }
    // The reason stays in the box; the person sees the text and, when the state
    // may have moved on, the change is read again before the next attempt.
    setAlert(failureKey(failure, 'write', canSwitch));
    if (shouldReload(failure)) {
      setVersion(v => v + 1);
    }
  };

  const dismissAlert = () => {
    setAlert(undefined);
    const target =
      root.current?.querySelector<HTMLElement>('[data-decision-heading]') ??
      root.current?.querySelector<HTMLElement>('h1');
    target?.focus();
  };

  const failure = section.failure;
  const notFound = failure?.kind === 'api' && failure.code === 'NOT_FOUND';
  const unreachable =
    section.state.status === 'server-error' ||
    (section.state.status === 'load-failed' && failure?.kind === 'no-answer');

  const backLink = (variant: 'outlined' | 'text') => (
    <Button
      component={RouterLink}
      to=".."
      role="link"
      variant={variant}
      size="small"
    >
      {t('label.back')}
    </Button>
  );

  let body: ReactNode;
  if (notFound) {
    body = (
      <div>
        <Typography variant="body1">{t('error.notFound')}</Typography>
        {backLink('outlined')}
      </div>
    );
  } else if (unreachable) {
    body = (
      <div>
        <ServerErrorPanel onRetry={section.reload} />
        {backLink('text')}
      </div>
    );
  } else {
    body = (
      <SectionState
        state={section.state}
        failure={failure}
        refreshing={section.refreshing}
        name={t('text.change')}
        loadingText={t('loading.change')}
        emptyKey="error.notFound"
        onRetry={section.reload}
      >
        {data => (
          <>
            <ChangeSummary change={data} />
            <DecisionBlock change={data} />
            <ReasonForm
              change={data}
              reason={reason}
              onReasonChange={value => {
                setReason(value);
                if (reasonError) setReasonError(undefined);
              }}
              errorKey={reasonError}
              refreshing={section.refreshing}
              submitting={submitting}
              serverDown={false}
              onSubmit={submit}
            />
            {!['pending', 'failed'].includes(data.status) && (
              <div>{backLink('outlined')}</div>
            )}
          </>
        )}
      </SectionState>
    );
  }

  return (
    <div ref={root}>
      <GuardrailsHeader
        service={service}
        changeTitle={title}
        onSwitched={() => setAlert(undefined)}
      />
      <main style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {alert && <RefusalAlert messageKey={alert} onDismiss={dismissAlert} />}
        <Paper style={{ padding: 16 }}>{body}</Paper>
      </main>
    </div>
  );
}
