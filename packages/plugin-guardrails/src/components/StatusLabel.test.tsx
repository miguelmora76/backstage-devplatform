import { render, screen } from '@testing-library/react';
import {
  createTheme,
  ThemeProvider,
  type Theme,
} from '@material-ui/core/styles';
import { getContrastRatio } from '@material-ui/core/styles/colorManipulator';
import { themes } from '@backstage/theme';
import { statusKey, t } from '../texts/texts';
import { StatusLabel } from './StatusLabel';

// FR2.3 and FR2.2: a status takes its colour from the theme, so it is readable
// in the dark and in the light theme, and it always has its word as well.
const STATUSES = [
  'pending',
  'refused',
  'applied',
  'rejected',
  'failed',
  'proposed',
] as const;

const backstageThemes: Record<'dark' | 'light', Theme> = {
  dark: themes.dark.getTheme('v4') as Theme,
  light: themes.light.getTheme('v4') as Theme,
};

/**
 * A theme whose status colours cannot be mistaken for any fixed colour. They
 * all read well on the black surface, so the label shows them unchanged.
 */
const sentinel = createTheme({
  palette: {
    type: 'dark',
    background: { paper: '#000000', default: '#000000' },
    warning: { main: '#fffe01' },
    success: { main: '#01fe01' },
    error: { main: '#fe0101' },
    info: { main: '#01fefe' },
  },
});

const ROLE: Record<
  (typeof STATUSES)[number],
  'warning' | 'success' | 'error' | 'info'
> = {
  pending: 'warning',
  refused: 'warning',
  applied: 'success',
  rejected: 'error',
  failed: 'error',
  proposed: 'info',
};

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function renderIn(theme: Theme, status: (typeof STATUSES)[number]) {
  render(
    <ThemeProvider theme={theme}>
      <StatusLabel status={status} />
    </ThemeProvider>,
  );
  return screen.getByTestId(`status-${status}`);
}

describe('StatusLabel colours (FR2.3, FR2.2)', () => {
  it.each(STATUSES)(
    'takes the colour of %s from the active theme, not a fixed colour',
    status => {
      const label = renderIn(sentinel, status);
      expect(window.getComputedStyle(label).color).toBe(
        rgb(sentinel.palette[ROLE[status]].main),
      );
    },
  );

  describe.each(['dark', 'light'] as const)('in the %s theme', mode => {
    it.each(STATUSES)(
      'shows %s with a text colour of at least 4.5:1 against the surface',
      status => {
        const theme = backstageThemes[mode];
        const label = renderIn(theme, status);
        const colour = window.getComputedStyle(label).color;
        // getContrastRatio reads rgb() values as well as hex.
        expect(
          getContrastRatio(colour, theme.palette.background.paper),
        ).toBeGreaterThanOrEqual(4.5);
      },
    );
  });

  it.each(STATUSES)('still shows the word and an icon for %s', status => {
    const label = renderIn(backstageThemes.dark, status);
    expect(label).toHaveTextContent(t(statusKey(status)));
    expect(label.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
