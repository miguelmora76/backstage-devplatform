import { percentile } from './percentile';

describe('percentile (nearest rank)', () => {
  const twenty = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);

  it('takes the 19th smallest of 20 samples for the 95th percentile', () => {
    expect(percentile(twenty, 95)).toBe(1900);
  });

  it('does not depend on the order of the samples', () => {
    const shuffled = [...twenty].reverse();
    expect(percentile(shuffled, 95)).toBe(1900);
    expect(shuffled[0]).toBe(2000);
  });

  it('gives the same value when all samples are equal', () => {
    expect(percentile(Array(20).fill(740), 95)).toBe(740);
  });

  it('takes the largest sample for the 100th percentile and the smallest for a tiny one', () => {
    expect(percentile(twenty, 100)).toBe(2000);
    expect(percentile(twenty, 1)).toBe(100);
  });

  it('refuses a sample count other than the one expected', () => {
    expect(() => percentile(twenty.slice(0, 19), 95, 20)).toThrow(
      /expected 20 samples, got 19/,
    );
    expect(percentile(twenty, 95, 20)).toBe(1900);
  });

  it('refuses no samples, a bad percentage and samples that are not numbers', () => {
    expect(() => percentile([], 95)).toThrow(/no samples/);
    expect(() => percentile(twenty, 0)).toThrow(/percentage/);
    expect(() => percentile(twenty, 101)).toThrow(/percentage/);
    expect(() => percentile([1, Number.NaN], 95)).toThrow(/finite/);
  });

  it('does not change the array it is given', () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    expect(input).toEqual([3, 1, 2]);
  });
});
