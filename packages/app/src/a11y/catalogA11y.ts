/**
 * Accessibility repairs for Backstage's own catalog list (found by the
 * end-to-end scan of u5, approved edit to u4). The list is a third-party
 * table whose markup the app cannot change, so the few attributes that fail
 * WCAG 2.1 AA are set after it renders. Nothing else on the page changes.
 *
 * - The column drag handle is a button inside the sort-label button (axe
 *   `nested-interactive`): the handle leaves the button role and the tab
 *   order; the sort label keeps both.
 * - Each filter combobox gets the name of the label text before it.
 * - The list table and the paging table get a name.
 * - A tab (settings page) that points at a panel not on the page loses that pointer.
 */
const ZERO_WIDTH = new RegExp('[\\u200b-\\u200d\\ufeff]', 'g');

export function fixCatalogAccessibility(root: ParentNode): void {
  root
    .querySelectorAll<HTMLElement>('th [role="button"] [role="button"]')
    .forEach(handle => {
      handle.setAttribute('tabindex', '-1');
      handle.removeAttribute('role');
      handle.removeAttribute('aria-describedby');
    });

  // The settings page's tabs name a panel that is not on the page until the
  // tab is chosen (axe `aria-valid-attr-value`); a reference to nothing is
  // dropped, a reference to a panel that exists is kept.
  root
    .querySelectorAll<HTMLElement>('[role="tab"][aria-controls]')
    .forEach(tab => {
      const target = tab.getAttribute('aria-controls');
      if (target && !tab.ownerDocument.getElementById(target)) {
        tab.removeAttribute('aria-controls');
      }
    });

  root.querySelectorAll<HTMLElement>('[role="combobox"]').forEach(combobox => {
    if (
      combobox.hasAttribute('aria-label') ||
      combobox.hasAttribute('aria-labelledby')
    ) {
      return;
    }
    const label = combobox.previousElementSibling?.textContent
      ?.replace(ZERO_WIDTH, '')
      .trim();
    if (label) {
      combobox.setAttribute('aria-label', label);
    }
  });

  root.querySelectorAll<HTMLElement>('table').forEach(table => {
    if (
      table.hasAttribute('aria-label') ||
      table.hasAttribute('aria-labelledby') ||
      table.querySelector('caption')
    ) {
      return;
    }
    table.setAttribute(
      'aria-label',
      table.querySelector('thead') ? 'Catalog entries' : 'Catalog paging',
    );
  });
}
