import { PrinterErrorCode, PrinterErrorException, errorCodeOf } from '../PrinterError';

describe('PrinterErrorCode', () => {
  it('có đủ bộ code §101', () => {
    const required = [
      'PRINTER_NOT_FOUND', 'PRINTER_ALREADY_EXISTS', 'PRINTER_CONNECTION_FAILED',
      'PRINTER_CONNECTION_TIMEOUT', 'PRINTER_NOT_CONNECTED', 'PRINTER_PROTOCOL_UNKNOWN',
      'PRINTER_UNSUPPORTED_CONNECTION', 'PRINTER_BUSY', 'PRINTER_WRITE_FAILED',
      'IMAGE_REQUIRED', 'IMAGE_INVALID', 'IMAGE_TOO_LARGE',
      'TSPL_RENDER_MODE_UNSUPPORTED', 'TSPL_ELEMENT_UNSUPPORTED',
      'VALIDATION_ERROR', 'NO_AVAILABLE_PRINTER', 'UNKNOWN_ERROR',
    ] as const;
    for (const code of required) expect(PrinterErrorCode[code]).toBe(code);
  });

  it('không còn code cũ đã bỏ', () => {
    expect((PrinterErrorCode as Record<string, string>).CONNECTION_ERROR).toBeUndefined();
    expect((PrinterErrorCode as Record<string, string>).ENCODING_FAILED).toBeUndefined();
    expect((PrinterErrorCode as Record<string, string>).PRINT_ERROR).toBeUndefined();
    expect((PrinterErrorCode as Record<string, string>).UNSUPPORTED_CONNECTION).toBeUndefined();
  });

  it('errorCodeOf trả UNKNOWN_ERROR cho lỗi không phải PrinterErrorException', () => {
    expect(errorCodeOf(new Error('x'))).toBe(PrinterErrorCode.UNKNOWN_ERROR);
    expect(errorCodeOf(new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_FOUND, message: 'y' }))).toBe(PrinterErrorCode.PRINTER_NOT_FOUND);
  });
});
