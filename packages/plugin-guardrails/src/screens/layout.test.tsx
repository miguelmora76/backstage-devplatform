import { screen, waitFor } from '@testing-library/react';
import { GuardrailsView } from './GuardrailsView';
import { renderScreen, setupStandIn } from '../testing/harness';
import { SERVICE } from '../testing/standIn/handlers';

// FR3.1: the two-column grid of the Guardrails view must be able to shrink to
// the window. A column with a fixed minimum width (for example
// `minmax(420px, 1fr)`) pushes the content past the right edge in a narrow
// content area. The real-browser check of the six views at three window widths
// is packages/e2e/specs/layout.spec.ts.
setupStandIn();

describe('GuardrailsView grid (FR3.1)', () => {
  it('has columns that shrink with the window instead of a fixed minimum width', async () => {
    renderScreen(<GuardrailsView service={SERVICE} />);
    await waitFor(() =>
      expect(
        screen.getByText('Upgrade lib-a from 1.2 to 2.0'),
      ).toBeInTheDocument(),
    );

    const grid = screen.getByTestId('guardrails-sections');
    const columns = grid.getAttribute('style') ?? '';
    expect(columns).toContain('grid-template-columns');
    // Every minimum is either relative (a percentage, via min()) or zero.
    expect(columns).not.toMatch(/minmax\(\s*\d+(\.\d+)?px/);
    expect(columns).toMatch(/minmax\(\s*min\(100%,\s*\d+px\)\s*,\s*1fr\)/);
  });

  it('keeps both sections inside the grid and lets each one shrink (minWidth 0)', async () => {
    renderScreen(<GuardrailsView service={SERVICE} />);
    await waitFor(() =>
      expect(
        screen.getByText('Upgrade lib-a from 1.2 to 2.0'),
      ).toBeInTheDocument(),
    );
    const grid = screen.getByTestId('guardrails-sections');
    const sections = Array.from(grid.children);
    expect(sections).toHaveLength(2);
    for (const section of sections) {
      expect(section).toHaveStyle({ minWidth: '0' });
    }
  });
});
