import { formatNumber } from '..';

describe('formatNumber', () => {
  it.each([
    [0, 0, '0'],
    [45000, 0, '45.000'],
    [1234567.891, 2, '1.234.567,89'],
    [-1500, 0, '-1.500'],
    [-0.001, 0, '0'],
    [999.5, 0, '1.000'],
    [12.5, 1, '12,5'],
    [100, 2, '100,00'],
  ])('formatNumber(%p, %p) = %p', (value, decimals, expected) => {
    expect(formatNumber(value, decimals)).toBe(expected);
  });

  it('throw với NaN/Infinity', () => {
    expect(() => formatNumber(Number.NaN)).toThrow('Không format được số');
    expect(() => formatNumber(Number.POSITIVE_INFINITY)).toThrow('Không format được số');
  });
});
