import { formatDateTime } from '..';

describe('formatDateTime', () => {
  const localIso = '2026-09-04T08:05:09';

  it('thay đúng từng token, giữ nguyên ký tự khác', () => {
    expect(formatDateTime(localIso, 'dd/MM/yyyy HH:mm:ss')).toBe(
      '04/09/2026 08:05:09'
    );
    expect(formatDateTime(localIso, 'yy-MM-dd')).toBe('26-09-04');
    expect(formatDateTime(localIso, 'HH:mm')).toBe('08:05');
  });

  it('nhận epoch ms', () => {
    const epochMs = new Date(2026, 8, 4, 8, 5, 9).getTime();

    expect(formatDateTime(epochMs, 'dd/MM/yyyy HH:mm')).toBe('04/09/2026 08:05');
  });

  it('throw với input không phải ngày giờ', () => {
    expect(() => formatDateTime('not a date', 'dd')).toThrow(
      'không phải ngày giờ hợp lệ'
    );
    expect(() => formatDateTime(true, 'dd')).toThrow(
      'không phải ngày giờ hợp lệ'
    );
  });
});
