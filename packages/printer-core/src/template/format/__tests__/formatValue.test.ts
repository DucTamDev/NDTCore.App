import { formatValue } from '..';

describe('formatValue', () => {
  it('dùng format mặc định theo kiểu biến khi segment không khai báo format', () => {
    expect(formatValue(45000, undefined, 'money')).toBe('45.000đ');
    expect(formatValue('2026-09-04T08:05:09', undefined, 'datetime')).toBe(
      '04/09/2026 08:05'
    );
    expect(formatValue(1234.5, undefined, 'number')).toBe('1234.5');
    expect(formatValue(true, undefined, 'boolean')).toBe('true');
  });

  it('format khai báo trong segment được ưu tiên hơn mặc định', () => {
    expect(formatValue(1234.5, { type: 'number', decimals: 1 }, 'number')).toBe(
      '1.234,5'
    );
    expect(
      formatValue(45000, { type: 'currency', symbol: 'VND' }, 'money')
    ).toBe('45.000 VND');
  });

  it('throw khi format số gặp giá trị không phải số', () => {
    expect(() =>
      formatValue('45000', { type: 'number' }, 'string')
    ).toThrow('không phải số');
  });
});
