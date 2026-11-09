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
