import { useEffect, useId, useRef, useState } from 'react';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { t, type TextKey } from '../texts/texts';
import { srOnly } from './srOnly';

/** The box stops at 500 characters; the backend allows 2,000 (D2). */
export const REASON_LIMIT = 500;

const THRESHOLDS = [100, 50, 20, 0];

export interface ReasonFieldProps {
  value: string;
  onChange: (value: string) => void;
  errorKey?: TextKey;
}

/**
 * The reason box (BR3.2, BR7.3). It has a visible label; the count of
 * characters left is visible always and announced only at 100, 50, 20 and 0
 * left; the error text is linked to the box.
 */
export const ReasonField = ({
  value,
  onChange,
  errorKey,
}: ReasonFieldProps) => {
  const id = useId();
  const countId = `${id}-count`;
  const errorId = `${id}-error`;
  const remaining = REASON_LIMIT - value.length;
  const [announcement, setAnnouncement] = useState('');
  const previous = useRef(remaining);

  useEffect(() => {
    const before = previous.current;
    previous.current = remaining;
    const crossed = THRESHOLDS.some(x => before > x && remaining <= x);
    const exact = THRESHOLDS.includes(remaining);
    setAnnouncement(
      exact || crossed ? t('status.counter', { n: remaining }) : '',
    );
  }, [remaining]);

  return (
    <div>
      <TextField
        id={id}
        label={t('label.reason')}
        multiline
        minRows={4}
        fullWidth
        variant="outlined"
        value={value}
        error={errorKey !== undefined}
        onChange={e => onChange(e.target.value.slice(0, REASON_LIMIT))}
        inputProps={{
          maxLength: REASON_LIMIT,
          'aria-describedby': errorKey ? `${errorId} ${countId}` : countId,
          'aria-invalid': errorKey ? 'true' : undefined,
          'data-testid': 'reason',
        }}
      />
      {errorKey && (
        <Typography
          id={errorId}
          variant="body2"
          color="error"
          data-testid="reason-error"
        >
          {t(errorKey)}
        </Typography>
      )}
      <Typography id={countId} variant="caption" data-testid="reason-count">
        {t('status.counter', { n: remaining })}
      </Typography>
      <span
        role="status"
        aria-live="polite"
        style={srOnly}
        data-testid="reason-announcement"
      >
        {announcement}
      </span>
    </div>
  );
};
