import { AppErrorCode, AppErrorException, errorCodeOf } from '../AppError';

describe('AppErrorCode', () => {
  it('có đủ bộ code §101', () => {
    const required = [
      'PRINTER_NOT_FOUND', 'PRINTER_ALREADY_EXISTS', 'PRINTER_CONNECTION_FAILED',
      'PRINTER_CONNECTION_TIMEOUT', 'PRINTER_NOT_CONNECTED', 'PRINTER_PROTOCOL_UNKNOWN',
      'PRINTER_UNSUPPORTED_CONNECTION', 'PRINTER_BUSY', 'PRINTER_WRITE_FAILED',
      'TSPL_IMAGE_REQUIRED', 'TSPL_IMAGE_INVALID', 'TSPL_IMAGE_TOO_LARGE',
      'TSPL_FONT_NOT_INSTALLED', 'TSPL_FONT_INSTALL_FAILED', 'TSPL_FONT_INVALID',
      'TSPL_RENDER_MODE_UNSUPPORTED', 'TSPL_ELEMENT_UNSUPPORTED',
      'VALIDATION_ERROR', 'NO_AVAILABLE_PRINTER', 'UNKNOWN_ERROR',
    ] as const;
    for (const code of required) expect(AppErrorCode[code]).toBe(code);
  });

  it('không còn code cũ đã bỏ', () => {
    expect((AppErrorCode as Record<string, string>).CONNECTION_ERROR).toBeUndefined();
    expect((AppErrorCode as Record<string, string>).ENCODING_FAILED).toBeUndefined();
    expect((AppErrorCode as Record<string, string>).PRINT_ERROR).toBeUndefined();
    expect((AppErrorCode as Record<string, string>).UNSUPPORTED_CONNECTION).toBeUndefined();
  });

  it('errorCodeOf trả UNKNOWN_ERROR cho lỗi không phải AppErrorException', () => {
    expect(errorCodeOf(new Error('x'))).toBe(AppErrorCode.UNKNOWN_ERROR);
    expect(errorCodeOf(new AppErrorException({ code: AppErrorCode.PRINTER_NOT_FOUND, message: 'y' }))).toBe(AppErrorCode.PRINTER_NOT_FOUND);
  });
});
