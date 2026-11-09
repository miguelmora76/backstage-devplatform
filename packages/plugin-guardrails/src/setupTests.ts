import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

// NFR7.1: the same data gives the same screens every run. The time zone is
// pinned in jestGlobalSetup.js (and in the test script), and tests that need
// a clock use fake timers with an explicit start time.

expect.extend(toHaveNoViolations);

// Material UI 4 (the version Backstage components use) calls findDOMNode,
// which React 18 warns about on every render. The warning is not about this
// plugin's code; every other console message still reaches the tests.
// eslint-disable-next-line no-console
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
// Tests that spy on the console restore it; put the filter back for the next one.
afterEach(() => {
  consoleSpy.mockImplementation(filterFindDomNode);
});
