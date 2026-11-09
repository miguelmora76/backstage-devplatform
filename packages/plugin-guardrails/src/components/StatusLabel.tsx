import type { ChangeStatus, Outcome } from '../api/types';
import { statusKey, t } from '../texts/texts';

type Status = ChangeStatus | Outcome;

// Status is always an icon plus a word, never colour alone (BR7.1).
const SHAPES: Record<Status, { path: string; color: string }> = {
  // exclamation in a circle
  pending: {
    path: 'M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3h1.5v5h-1.5V4zm0 6h1.5v1.5h-1.5V10z',
    color: '#8a5a00',
  },
  refused: {
    path: 'M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3h1.5v5h-1.5V4zm0 6h1.5v1.5h-1.5V10z',
    color: '#8a5a00',
  },
  // check in a circle
  applied: {
    path: 'M8 1a7 7 0 100 14A7 7 0 008 1zm-1.2 9.6L4.2 8l1.1-1.1 1.5 1.5 3.9-3.9L11.8 5.6 6.8 10.6z',
    color: '#1b6e2d',
  },
  // cross in a circle
  rejected: {
    path: 'M8 1a7 7 0 100 14A7 7 0 008 1zm3 8.9l-1.1 1.1L8 9.1 6.1 11 5 9.9 6.9 8 5 6.1 6.1 5 8 6.9 9.9 5 11 6.1 9.1 8 11 9.9z',
    color: '#9b1c1c',
  },
  failed: {
    path: 'M8 1a7 7 0 100 14A7 7 0 008 1zm3 8.9l-1.1 1.1L8 9.1 6.1 11 5 9.9 6.9 8 5 6.1 6.1 5 8 6.9 9.9 5 11 6.1 9.1 8 11 9.9z',
    color: '#9b1c1c',
  },
  // info in a circle
  proposed: {
    path: 'M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3h1.5v1.5h-1.5V4zm0 3h1.5v5h-1.5V7z',
    color: '#1f3a93',
  },
};

export function StatusLabel({ status }: { status: Status }) {
  const shape = SHAPES[status];
  return (
    <span
      data-testid={`status-${status}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: shape.color,
        fontWeight: 500,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d={shape.path} />
      </svg>
      <span>{t(statusKey(status))}</span>
    </span>
  );
}
