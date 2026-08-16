import { formatCurrency } from '../formatCurrency';

describe('formatCurrency', () => {
  it('formats a whole number with Vietnamese thousands separators and a đ suffix', () => {
    expect(formatCurrency(60000)).toBe('60.000đ');
  });

  it('rounds a fractional amount to the nearest whole number', () => {
    expect(formatCurrency(1500.6)).toBe('1.501đ');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('0đ');
  });

  it('falls back to 0đ instead of printing "NaNđ" when the input is not a finite number', () => {
    expect(formatCurrency(NaN)).toBe('0đ');
    expect(formatCurrency(Infinity)).toBe('0đ');
    expect(formatCurrency(-Infinity)).toBe('0đ');
  });
});
