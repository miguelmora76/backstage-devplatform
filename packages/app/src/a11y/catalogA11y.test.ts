import { fixCatalogAccessibility } from './catalogA11y';

function build(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('fixCatalogAccessibility (catalog list, WCAG 2.1 AA)', () => {
  it('takes the drag handle out of the tab order and out of the button role inside a sort label', () => {
    const root = build(
      '<table><thead><tr><th><span role="button" tabindex="0"><div role="button" tabindex="0" aria-describedby="x">Name</div></span></th></tr></thead></table>',
    );
    fixCatalogAccessibility(root);
    const handle = root.querySelector('th span div') as HTMLElement;
    expect(handle.getAttribute('tabindex')).toBe('-1');
    expect(handle.hasAttribute('role')).toBe(false);
    expect(handle.hasAttribute('aria-describedby')).toBe(false);
    // The sort label itself keeps its role and its place in the tab order.
    const sort = root.querySelector('th > span') as HTMLElement;
    expect(sort.getAttribute('role')).toBe('button');
    expect(sort.getAttribute('tabindex')).toBe('0');
  });

  it('names a combobox from the label text that sits before it', () => {
    const root = build(
      '<div><span>Owner​</span><div role="combobox"><input type="text"></div></div>',
    );
    fixCatalogAccessibility(root);
    expect(
      root.querySelector('[role=combobox]')!.getAttribute('aria-label'),
    ).toBe('Owner');
  });

  it('keeps a name that is already there and ignores a combobox with no label text', () => {
    const root = build(
      '<div><span>Owner</span><div role="combobox" aria-label="Mine"></div></div><div><div role="combobox"></div></div>',
    );
    fixCatalogAccessibility(root);
    const [named, bare] = Array.from(root.querySelectorAll('[role=combobox]'));
    expect(named.getAttribute('aria-label')).toBe('Mine');
    expect(bare.hasAttribute('aria-label')).toBe(false);
  });

  it('names the list table and the paging table, and leaves a named table alone', () => {
    const root = build(
      '<table><thead></thead></table><table><tfoot></tfoot></table><table aria-label="Mine"><thead></thead></table><table><caption>C</caption><thead></thead></table>',
    );
    fixCatalogAccessibility(root);
    const tables = Array.from(root.querySelectorAll('table'));
    expect(tables[0].getAttribute('aria-label')).toBe('Catalog entries');
    expect(tables[1].getAttribute('aria-label')).toBe('Catalog paging');
    expect(tables[2].getAttribute('aria-label')).toBe('Mine');
    expect(tables[3].hasAttribute('aria-label')).toBe(false);
  });

  it('is safe to run twice', () => {
    const root = build(
      '<div><span>Owner</span><div role="combobox"></div></div>',
    );
    fixCatalogAccessibility(root);
    fixCatalogAccessibility(root);
    expect(
      root.querySelector('[role=combobox]')!.getAttribute('aria-label'),
    ).toBe('Owner');
  });
});
