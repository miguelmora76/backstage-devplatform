import { useEffect } from 'react';
import { fixCatalogAccessibility } from './catalogA11y';

/**
 * Renders nothing; keeps the repairs of `fixCatalogAccessibility` applied
 * while pages change (a root element of the app, so it needs no page of its
 * own). Only added or removed nodes are watched, never attributes, so the
 * repairs cannot trigger themselves.
 */
export function CatalogA11yFix() {
  useEffect(() => {
    let scheduled = 0;
    const run = () => {
      scheduled = 0;
      fixCatalogAccessibility(document.body);
    };
    const observer = new MutationObserver(() => {
      if (!scheduled) {
        scheduled = window.requestAnimationFrame(run);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    run();
    return () => {
      observer.disconnect();
      if (scheduled) {
        window.cancelAnimationFrame(scheduled);
      }
    };
  }, []);
  return null;
}
