import { useId } from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import type { AuditAction, DemoUser, Outcome } from '../api/types';
import { statusKey, t } from '../texts/texts';

export interface FilterValues {
  /** Calendar dates, `YYYY-MM-DD`, or empty. */
  from: string;
  to: string;
  actor: string;
  action: '' | AuditAction;
  outcome: '' | Outcome;
}

export const NO_FILTERS: FilterValues = {
  from: '',
  to: '',
  actor: '',
  action: '',
  outcome: '',
};

const ACTIONS: AuditAction[] = ['propose', 'approve', 'reject', 'retry'];
const OUTCOMES: Outcome[] = [
  'proposed',
  'applied',
  'rejected',
  'failed',
  'refused',
];

export interface AuditFiltersProps {
  users: DemoUser[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  rangeInvalid: boolean;
  disabled?: boolean;
}

/**
 * From, To, Actor, Action, Outcome and Clear filters (BR4.2). Choices come from
 * fixed lists or the demo users; a reason never travels as a filter (NFR5.6).
 */
export function AuditFilters({
  users,
  values,
  onChange,
  rangeInvalid,
  disabled,
}: AuditFiltersProps) {
  const id = useId();
  const errorId = `${id}-range`;
  const set = (patch: Partial<FilterValues>) =>
    onChange({ ...values, ...patch });
  const describedBy = rangeInvalid ? errorId : undefined;
  const common = {
    disabled,
    variant: 'outlined' as const,
    size: 'small' as const,
  };

  return (
    <div
      role="group"
      aria-label={t('label.filters')}
      style={{ marginBottom: 12 }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <TextField
          {...common}
          id={`${id}-from`}
          type="date"
          label={t('label.from')}
          value={values.from}
          error={rangeInvalid}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'aria-describedby': describedBy }}
          onChange={e => set({ from: e.target.value })}
        />
        <TextField
          {...common}
          id={`${id}-to`}
          type="date"
          label={t('label.to')}
          value={values.to}
          error={rangeInvalid}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'aria-describedby': describedBy }}
          onChange={e => set({ to: e.target.value })}
        />
        <TextField
          {...common}
          id={`${id}-actor`}
          select
          label={t('label.actor')}
          value={values.actor}
          SelectProps={{ native: true }}
          InputLabelProps={{ shrink: true }}
          onChange={e => set({ actor: e.target.value })}
        >
          <option value="">{t('label.all')}</option>
          {users.map(u => (
            <option key={u.userId} value={u.userId}>
              {u.name}
            </option>
          ))}
        </TextField>
        <TextField
          {...common}
          id={`${id}-action`}
          select
          label={t('label.action')}
          value={values.action}
          SelectProps={{ native: true }}
          InputLabelProps={{ shrink: true }}
          onChange={e =>
            set({ action: e.target.value as FilterValues['action'] })
          }
        >
          <option value="">{t('label.all')}</option>
          {ACTIONS.map(a => (
            <option key={a} value={a}>
              {t(`action.${a}`)}
            </option>
          ))}
        </TextField>
        <TextField
          {...common}
          id={`${id}-outcome`}
          select
          label={t('label.outcome')}
          value={values.outcome}
          SelectProps={{ native: true }}
          InputLabelProps={{ shrink: true }}
          onChange={e =>
            set({ outcome: e.target.value as FilterValues['outcome'] })
          }
        >
          <option value="">{t('label.all')}</option>
          {OUTCOMES.map(o => (
            <option key={o} value={o}>
              {t(statusKey(o))}
            </option>
          ))}
        </TextField>
        <Button
          size="small"
          variant="outlined"
          disabled={disabled}
          onClick={() => onChange(NO_FILTERS)}
        >
          {t('label.clearFilters')}
        </Button>
      </div>
      {rangeInvalid && (
        <Typography id={errorId} variant="body2" color="error">
          {t('error.dateRange')}
        </Typography>
      )}
    </div>
  );
}
