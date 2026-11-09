import Typography from '@material-ui/core/Typography';
import type { Change } from '../api/types';
import { formatTime } from '../texts/formatTime';
import { t } from '../texts/texts';

/**
 * "Decided by", the reason as entered, and for a failed change the failure
 * message (BR3.7). Its heading takes focus when a refusal alert is dismissed
 * (BR3.6), so it carries a marker the screen can find.
 */
export function DecisionBlock({ change }: { change: Change }) {
  if (!change.decidedBy || !change.decidedAt) {
    return null;
  }
  return (
    <div data-testid="decision-block" style={{ margin: '8px 0 12px' }}>
      <Typography
        variant="h6"
        component="h2"
        tabIndex={-1}
        data-decision-heading="true"
      >
        {t('text.decidedBy', {
          name: change.decidedBy.name,
          time: formatTime(change.decidedAt),
        })}
      </Typography>
      {change.decisionReason !== undefined && (
        <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
          {change.decisionReason}
        </Typography>
      )}
      {change.status === 'failed' && change.failureMessage !== undefined && (
        <Typography variant="body1" data-testid="failure-message">
          {t('text.couldNotApply', { message: change.failureMessage })}
        </Typography>
      )}
    </div>
  );
}
