import { timingBlocking } from './timingSwitch';

describe('timingBlocking (NFR1.5)', () => {
  it('is off only for exactly "false"', () => {
    expect(timingBlocking('false')).toBe(false);
  });

  it.each([
    ['true', 'true'],
    ['unset', undefined],
    ['empty', ''],
    ['a typo', 'flase'],
    ['other case', 'False'],
    ['padded', ' false '],
    ['zero', '0'],
  ])('keeps the check blocking for %s', (_name, value) => {
    expect(timingBlocking(value)).toBe(true);
  });
});
