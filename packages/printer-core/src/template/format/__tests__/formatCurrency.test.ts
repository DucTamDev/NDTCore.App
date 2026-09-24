import { formatCurrency } from '..';

describe('formatCurrency', () => {
  it.each([
    [{ type: 'currency' as const }, 45000, '45.000đ'],
    [{ type: 'currency' as const, symbol: '₫' as const }, 45000, '45.000₫'],
    [{ type: 'currency' as const, symbol: 'VND' as const }, 45000, '45.000 VND'],
    [{ type: 'currency' as const, symbol: '' as const }, 45000, '45.000'],
    [{ type: 'currency' as const, decimals: 2 }, -1234.5, '-1.234,50đ'],
  ])('%j với %p = %p', (format, value, expected) => {
    expect(formatCurrency(value, format)).toBe(expected);
  });
});
