import { render, waitFor } from '@testing-library/react';
import { CatalogA11yFix } from './CatalogA11yFix';

describe('CatalogA11yFix', () => {
  it('repairs what is on the page and what is added later, and stops when removed', async () => {
    document.body.innerHTML =
      '<div><span>Owner</span><div role="combobox" id="a"></div></div>';
    const { unmount } = render(<CatalogA11yFix />);
    expect(document.getElementById('a')!.getAttribute('aria-label')).toBe(
      'Owner',
    );

    const added = document.createElement('div');
    added.innerHTML =
      '<span>Lifecycle</span><div role="combobox" id="b"></div>';
    document.body.appendChild(added);
    await waitFor(() =>
      expect(document.getElementById('b')!.getAttribute('aria-label')).toBe(
        'Lifecycle',
      ),
    );

    unmount();
    const later = document.createElement('div');
    later.innerHTML = '<span>Tags</span><div role="combobox" id="c"></div>';
    document.body.appendChild(later);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(document.getElementById('c')!.hasAttribute('aria-label')).toBe(
      false,
    );
  });
});
