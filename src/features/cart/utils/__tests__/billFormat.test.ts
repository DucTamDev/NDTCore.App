import { formatDateTime, PAYMENT_METHOD_LABEL } from '../billFormat';

describe('formatDateTime', () => {
  it('returns an empty string for null', () => {
    expect(formatDateTime(null)).toBe('');
  });

  it('formats an ISO string with day/month/year and hour:minute', () => {
    const result = formatDateTime('2026-08-21T09:05:00.000Z');
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe('PAYMENT_METHOD_LABEL', () => {
  it('maps known payment methods to Vietnamese labels', () => {
    expect(PAYMENT_METHOD_LABEL.Cash).toBe('Tiền mặt');
    expect(PAYMENT_METHOD_LABEL.Card).toBe('Thẻ');
    expect(PAYMENT_METHOD_LABEL.Transfer).toBe('Chuyển khoản');
    expect(PAYMENT_METHOD_LABEL.EWallet).toBe('Ví điện tử');
  });
});
