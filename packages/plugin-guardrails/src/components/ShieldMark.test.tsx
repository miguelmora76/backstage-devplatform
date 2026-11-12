import { render } from '@testing-library/react';
import {
  createTheme,
  ThemeProvider,
  type Theme,
} from '@material-ui/core/styles';
import { getContrastRatio } from '@material-ui/core/styles/colorManipulator';
import { themes } from '@backstage/theme';
import { ShieldMark } from './ShieldMark';

// FR2.3 and FR2.2: the shield takes its colour from the theme and stays
// visible against the page in the dark and in the light theme.
function shieldIn(theme: Theme, size?: number) {
  const { container } = render(
    <ThemeProvider theme={theme}>
      <ShieldMark size={size} />
    </ThemeProvider>,
  );
  return container.querySelector('svg') as SVGSVGElement;
}

describe('ShieldMark (FR2.3, FR2.2)', () => {
  it('takes its colour from the active theme, not a fixed colour', () => {
    const theme = createTheme({
      palette: { primary: { main: '#123456' } },
    });
    const shield = shieldIn(theme);
    expect(window.getComputedStyle(shield).color).toBe('rgb(18, 52, 86)');
    expect(shield).toHaveAttribute('fill', 'currentColor');
  });

  it.each(['dark', 'light'] as const)(
    'is at least 3:1 against the page in the %s theme',
    mode => {
      const theme = themes[mode].getTheme('v4') as Theme;
      const shield = shieldIn(theme);
      const colour = window.getComputedStyle(shield).color;
      expect(
        getContrastRatio(colour, theme.palette.background.default),
      ).toBeGreaterThanOrEqual(3);
      expect(
        getContrastRatio(colour, theme.palette.background.paper),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it('keeps its size and stays hidden from assistive technology', () => {
    const shield = shieldIn(createTheme(), 32);
    expect(shield).toHaveAttribute('width', '32');
    expect(shield).toHaveAttribute('height', '32');
    expect(shield).toHaveAttribute('aria-hidden', 'true');
  });
});
