import type { ReactNode } from 'react';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Skeleton from '@material-ui/lab/Skeleton';
import type { Failure } from '../api/failures';
import type { SectionState as State } from '../hooks/useSection';
import { useCanSwitch } from '../context';
import { failureKey, t, type TextKey } from '../texts/texts';
import { ServerErrorPanel } from './ServerErrorPanel';
import { srOnly } from './srOnly';

export interface SectionStateProps<T> {
  state: State<T>;
  failure?: Failure;
  /** A reload is running on top of kept data: busy, but the data stays. */
  refreshing?: boolean;
  /** Section name, used in the loading announcement. */
  name: string;
  /** Replaces the loading announcement (Screen C: "Loading change..."). */
  loadingText?: string;
  emptyKey: TextKey;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}

/**
 * Wraps a section's content: loading (marked busy, announced politely), empty
 * text, the server error panel, or `error.loadFailed` with Retry (BR1.2, BR6.1,
 * BR6.3, BR7.2).
 */
export function SectionState<T>({
  state,
  failure,
  refreshing = false,
  name,
  loadingText,
  emptyKey,
  onRetry,
  children,
}: SectionStateProps<T>) {
  const canSwitch = useCanSwitch();
  const loading = state.status === 'loading' || refreshing;
  let body: ReactNode = null;
  switch (state.status) {
    case 'loading':
      body = (
        <>
          <span role="status" style={srOnly}>
            {loadingText ?? t('loading.section', { section: name })}
          </span>
          <div aria-hidden="true">
            <Skeleton variant="text" />
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>
        </>
      );
      break;
    case 'loaded':
      body = children(state.data);
      break;
    case 'empty':
      body = <Typography variant="body1">{t(emptyKey)}</Typography>;
      break;
    case 'server-error':
      body = <ServerErrorPanel onRetry={onRetry} />;
      break;
    case 'load-failed': {
      // A section that is not the plan or CI never shows the server panel:
      // anything but the demo-session or not-found texts is loadFailed (BR6.3).
      let key: TextKey = failure
        ? failureKey(failure, 'read', canSwitch)
        : 'error.loadFailed';
      if (key === 'error.unreachable') key = 'error.loadFailed';
      body = (
        <div
          role="alert"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8 }}
        >
          <Typography variant="body1">{t(key)}</Typography>
          <Button size="small" variant="outlined" onClick={onRetry}>
            {t('label.retryLoad')}
          </Button>
        </div>
      );
      break;
    }
    default:
      body = null;
  }
  return <div aria-busy={loading ? 'true' : 'false'}>{body}</div>;
}
