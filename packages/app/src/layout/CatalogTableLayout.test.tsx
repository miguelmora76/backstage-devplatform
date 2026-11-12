import { render } from '@testing-library/react';
import { CatalogTableLayout } from './CatalogTableLayout';

// FR3.1, FR1.2: the catalog list has to fit the content area at 1024 and 1308
// pixels without its own sideways scrollbar, so its cells use less sideways
// padding and names are only ever wrapped at a hyphen, never inside a word.
// The catalog list is the table the app names "Catalog entries" (a11y repair).
// The real-browser check is packages/e2e/specs/layout.spec.ts.
function renderTables() {
  render(
    <>
      <CatalogTableLayout />
      <table aria-label="Catalog entries">
        <tbody>
          <tr>
            <td className="MuiTableCell-root" data-testid="catalog-cell">
              catalog-portal
            </td>
          </tr>
        </tbody>
      </table>
      <table aria-label="Dependency upgrade plan">
        <tbody>
          <tr>
            <td className="MuiTableCell-root" data-testid="plugin-cell">
              plugin table
            </td>
          </tr>
        </tbody>
      </table>
    </>,
  );
}

const style = (testId: string) =>
  window.getComputedStyle(
    document.querySelector(`[data-testid="${testId}"]`) as Element,
  );

describe('CatalogTableLayout (FR3.1)', () => {
  it('narrows the sideways padding of the catalog table cells', () => {
    renderTables();
    expect(style('catalog-cell').paddingLeft).toBe('4px');
    expect(style('catalog-cell').paddingRight).toBe('4px');
  });

  it('keeps names whole: no breaking inside a word', () => {
    renderTables();
    expect(style('catalog-cell').wordBreak).toBe('normal');
    expect(style('catalog-cell').overflowWrap).toBe('normal');
  });

  it('uses a denser table font so the table also fits where fonts are wider (Linux)', () => {
    renderTables();
    expect(style('catalog-cell').fontSize).toBe('0.8125rem');
  });

  it('leaves the tables of the Guardrails plugin as they are', () => {
    renderTables();
    expect(style('plugin-cell').paddingLeft).not.toBe('4px');
  });

  it('renders nothing visible', () => {
    const { container } = render(<CatalogTableLayout />);
    expect(container).toBeEmptyDOMElement();
  });
});
