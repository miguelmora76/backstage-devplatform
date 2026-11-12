import { useTheme } from '@material-ui/core/styles';
import { readableColour } from './readableColour';

/** The placeholder shield mark; replaceable in this one place (design-system-mapping). */
export function ShieldMark({ size = 24 }: { size?: number }) {
  const { palette } = useTheme();
  // The theme's main colour, moved only as far as a graphic needs (3:1) to
  // show on the page and on a card in the active theme.
  const color = readableColour(
    palette.primary.main,
    [palette.background.default, palette.background.paper],
    3,
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ color }}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2L4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z" />
    </svg>
  );
}
