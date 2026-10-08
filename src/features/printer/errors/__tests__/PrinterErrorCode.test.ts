import { DeviceErrorCode } from '../DeviceErrorCode';
import { PrinterErrorCode } from '../PrinterErrorCode';
import { PrintErrorCode } from '../PrintErrorCode';

describe.each([
  ['DeviceErrorCode', DeviceErrorCode],
  ['PrinterErrorCode', PrinterErrorCode],
  ['PrintErrorCode', PrintErrorCode],
])('%s', (_name, codes) => {
  it('giá trị mỗi mã trùng tên mã', () => {
    for (const [key, value] of Object.entries(codes)) expect(value).toBe(key);
  });
});

describe('PrinterErrorCode', () => {
  it('không chứa mã của tầng thiết bị hay của lệnh in', () => {
    const printerCodes: string[] = Object.values(PrinterErrorCode);

    expect(printerCodes).not.toContain('PRINTER_CONNECTION_FAILED');
    expect(printerCodes).not.toContain('IMAGE_TOO_LARGE');
    expect(printerCodes).not.toContain('UNKNOWN_ERROR');
  });
});
