import { useEffect, useId, useRef, useState } from 'react';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { t, type TextKey } from '../texts/texts';
import { srOnly } from './srOnly';

export interface GuardedButtonProps {
  /** Visible label. */
  label: string;
  /** Accessible name when the label alone is not enough (repeated row buttons). */
  ariaLabel?: string;
  /** From the backend's allowed actions; the button decides nothing itself (NFR5.8). */
  enabled: boolean;
  /** Why it is unavailable: shown beside the button and linked to it. */
  reasonKey?: TextKey;
  /** The owner says a request for this screen is running. */
  busy?: boolean;
  onActivate: () => void | Promise<unknown>;
  testId?: string;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'default';
}

/**
 * A button that stays focusable when the action is unavailable (marked with
 * aria-disabled, not removed from the tab order), shows the reason text linked
 * to it, sends nothing when activated while unavailable, and shows "Working..."
 * in the same render as the press. A second press while working is ignored,
 * even inside one frame, so one click makes one request (BR2.2, BR3.5).
 */
export function GuardedButton({
  label,
  ariaLabel,
  enabled,
  reasonKey,
  busy = false,
  onActivate,
  testId,
  variant = 'outlined',
  color = 'primary',
}: GuardedButtonProps) {
  const reasonId = useId();
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const showWorking = working || busy;
  const unavailable = !enabled || showWorking;

  const handleClick = () => {
    if (!enabled || busy || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setWorking(true);
    let result: void | Promise<unknown>;
    try {
      result = onActivate();
    } catch {
      result = undefined;
    }
    Promise.resolve(result)
      .catch(() => {})
      .finally(() => {
        inFlight.current = false;
        if (mounted.current) {
          setWorking(false);
        }
      });
  };

  const showReason = !enabled && reasonKey !== undefined;

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <Button
        variant={variant}
        color={color}
        size="small"
        aria-label={ariaLabel}
        aria-disabled={unavailable ? 'true' : undefined}
        aria-describedby={showReason ? reasonId : undefined}
        aria-busy={showWorking ? 'true' : undefined}
        data-testid={testId}
        style={unavailable ? { opacity: 0.6 } : undefined}
        onClick={handleClick}
      >
        {showWorking ? t('status.working') : label}
      </Button>
      {showReason && (
        <Typography variant="caption" id={reasonId} component="span">
          {t(reasonKey)}
        </Typography>
      )}
      <span role="status" style={srOnly}>
        {showWorking ? t('status.working') : ''}
      </span>
    </span>
  );
}
