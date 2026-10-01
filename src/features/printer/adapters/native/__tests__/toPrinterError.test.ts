import { toPrinterError } from '../toPrinterError';
import { PrinterErrorCode } from '../../../errors/PrinterError';

describe('toPrinterError', () => {
  it.each([
    ['INVALID_ARGUMENT', PrinterErrorCode.VALIDATION_ERROR],
    ['DEVICE_NOT_FOUND', PrinterErrorCode.PRINTER_NOT_FOUND],
    ['AMBIGUOUS_DEVICE', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
    ['PERMISSION_DENIED', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
    ['BLUETOOTH_DISABLED', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
    ['CONNECTION_FAILED', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
    ['NOT_CONNECTED', PrinterErrorCode.PRINTER_NOT_CONNECTED],
    ['CONNECTION_LOST', PrinterErrorCode.PRINTER_NOT_CONNECTED],
    ['SERVICE_CLOSED', PrinterErrorCode.PRINTER_NOT_CONNECTED],
    ['WRITE_FAILED', PrinterErrorCode.PRINTER_WRITE_FAILED],
    ['WRITE_TIMEOUT', PrinterErrorCode.PRINTER_WRITE_FAILED],
    ['READ_NOT_SUPPORTED', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
    ['READ_FAILED', PrinterErrorCode.PRINTER_CONNECTION_FAILED],
  ])('mã native %s → %s, kèm thông báo tiếng Việt và lỗi gốc', (nativeCode, expected) => {
    const nativeError = { code: nativeCode, message: 'native message' };

    const error = toPrinterError(nativeError);

    expect(error.code).toBe(expected);
    expect(error.message).not.toBe('native message');
    expect(error.cause).toBe(nativeError);
  });

  it('lỗi không có mã native giữ UNKNOWN_ERROR và thông báo gốc', () => {
    const error = toPrinterError(new Error('native connect failed'));

    expect(error.code).toBe(PrinterErrorCode.UNKNOWN_ERROR);
    expect(error.message).toBe('native connect failed');
  });
});
