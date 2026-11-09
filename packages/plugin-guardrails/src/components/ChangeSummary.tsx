import Typography from '@material-ui/core/Typography';
import type { Change } from '../api/types';
import { changeTitle } from '../rules/derive';
import { formatTime } from '../texts/formatTime';
import { t } from '../texts/texts';
import { StatusLabel } from './StatusLabel';

/**
 * Status, proposer and "What it will do" (BR3.1, D10). The title itself is the
 * h1 in the header. "What it will do" shows the kind label, the service and
 * the summary the backend wrote; the UI composes no sentence of its own.
 */
export function ChangeSummary({ change }: { change: Change }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StatusLabel status={change.status} />
      </div>
      <Typography variant="body2" style={{ margin: '8px 0' }}>
        {t('text.proposedBy', {
          name: change.proposedBy.name,
          time: formatTime(change.proposedAt),
        })}
      </Typography>
      <Typography variant="h6" component="h2">
        {t('text.whatItWillDo')}
      </Typography>
      <ul data-testid="what-it-will-do" style={{ margin: '4px 0 12px' }}>
        <li>
          {t(change.kind === 'upgrade' ? 'text.kindUpgrade' : 'text.kindRerun')}
        </li>
        <li>{change.service}</li>
        <li>{changeTitle(change)}</li>
      </ul>
    </div>
  );
}
