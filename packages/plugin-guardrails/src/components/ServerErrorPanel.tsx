import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { t } from '../texts/texts';

/** Replaces a section's content when the guardrails server is unreachable (BR6.1). */
export function ServerErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-testid="server-error"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8 }}
    >
      <Typography variant="body1">{t('error.unreachable')}</Typography>
      <Button size="small" variant="outlined" onClick={onRetry}>
        {t('label.retryLoad')}
      </Button>
    </div>
  );
}
