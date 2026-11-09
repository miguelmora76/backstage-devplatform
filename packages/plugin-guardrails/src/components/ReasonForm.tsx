import Button from '@material-ui/core/Button';
import { Link as RouterLink } from 'react-router-dom';
import type { ActionName, Change } from '../api/types';
import { actionState, decisionActionsFor } from '../rules/derive';
import { t, type TextKey } from '../texts/texts';
import { GuardedButton } from './GuardedButton';
import { ReasonField } from './ReasonField';

export type DecisionAction = Extract<
  ActionName,
  'approve' | 'reject' | 'retry'
>;

export interface ReasonFormProps {
  change: Change;
  reason: string;
  onReasonChange: (reason: string) => void;
  errorKey?: TextKey;
  /** The change is being read again after a failed write: no attempt yet. */
  refreshing: boolean;
  /** A decision is being sent. */
  submitting: boolean;
  /** The screen shows the server as unreachable. */
  serverDown: boolean;
  onSubmit: (action: DecisionAction) => void | Promise<unknown>;
}

const LABELS: Record<DecisionAction, TextKey> = {
  approve: 'label.approve',
  reject: 'label.reject',
  retry: 'label.retry',
};

/**
 * The reason box and the decision actions of Screen C (BR3.2, BR3.5). Focus
 * order is Back, reason, Reject, Approve. Which actions appear follows the
 * change's status (D11); whether each is enabled is the backend's answer.
 */
export function ReasonForm({
  change,
  reason,
  onReasonChange,
  errorKey,
  refreshing,
  submitting,
  serverDown,
  onSubmit,
}: ReasonFormProps) {
  const shown = decisionActionsFor(change.status).filter(
    (a): a is DecisionAction => a !== 'propose',
  );
  // Reject comes before Approve in the tab order.
  const ordered = [...shown].sort(
    (a, b) => Number(b === 'reject') - Number(a === 'reject'),
  );
  if (shown.length === 0) {
    return null;
  }
  return (
    <form
      noValidate
      onSubmit={e => e.preventDefault()}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div>
        <Button
          component={RouterLink}
          to=".."
          role="link"
          variant="text"
          size="small"
        >
          {t('label.back')}
        </Button>
      </div>
      <ReasonField
        value={reason}
        onChange={onReasonChange}
        errorKey={errorKey}
      />
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        {ordered.map(action => {
          const st = serverDown
            ? { enabled: false, reasonKey: 'disabled.unreachable' as const }
            : actionState(change.allowedActions, action);
          return (
            <GuardedButton
              key={action}
              label={t(LABELS[action])}
              enabled={st.enabled && !refreshing && !submitting}
              reasonKey={st.reasonKey}
              testId={action}
              variant={action === 'reject' ? 'outlined' : 'contained'}
              onActivate={() => onSubmit(action)}
            />
          );
        })}
      </div>
    </form>
  );
}
