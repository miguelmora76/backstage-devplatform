import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

// NFR7.1: the time zone is pinned in the plugin's jestGlobalSetup.js, which
// this package's Jest settings also run. Tests that need a clock use fake
// timers with an explicit start time.

expect.extend(toHaveNoViolations);

// Material UI 4 (the version Backstage components use) calls findDOMNode,
// which React 18 warns about on every render. The warning is not about this
// app's code; every other console message still reaches the tests.
const originalConsoleError = console.error;
const consoleSpy = jest.spyOn(console, 'error');
const filterFindDomNode = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('findDOMNode is deprecated')
  ) {
    return;
  }
  originalConsoleError(...args);
};
consoleSpy.mockImplementation(filterFindDomNode);
afterEach(() => {
  consoleSpy.mockImplementation(filterFindDomNode);
});
