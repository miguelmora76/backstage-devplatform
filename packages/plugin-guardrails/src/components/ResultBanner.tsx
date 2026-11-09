import { useEffect, useRef } from 'react';
import Alert from '@material-ui/lab/Alert';
import { t, type TextKey } from '../texts/texts';

export interface MessageProps {
  messageKey: TextKey;
  onDismiss: () => void;
}

/**
 * A result banner at the top of Screen B: a status region that takes focus
 * when it appears (or its message changes), is announced once, and has a close
 * button named `label.dismiss` (BR7.2).
 */
export function ResultBanner({ messageKey, onDismiss }: MessageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [messageKey]);
  const severity =
    messageKey === 'banner.applyFailed' || messageKey === 'banner.retryFailed'
      ? 'warning'
      : 'success';
  return (
    <Alert
      ref={ref}
      role="status"
      tabIndex={-1}
      severity={severity}
      closeText={t('label.dismiss')}
      onClose={onDismiss}
      data-testid="result-banner"
    >
      {t(messageKey)}
    </Alert>
  );
}
