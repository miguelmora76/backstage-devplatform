import { useEffect, useRef } from 'react';
import Alert from '@material-ui/lab/Alert';
import { t } from '../texts/texts';
import type { MessageProps } from './ResultBanner';

/**
 * An announced, dismissible alert for a refused decision or a failed write
 * (BR3.6). It takes focus when it appears or its message changes.
 */
export function RefusalAlert({ messageKey, onDismiss }: MessageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [messageKey]);
  return (
    <Alert
      ref={ref}
      role="alert"
      tabIndex={-1}
      severity="warning"
      closeText={t('label.dismiss')}
      onClose={onDismiss}
      data-testid="refusal-alert"
    >
      {t(messageKey)}
    </Alert>
  );
}
