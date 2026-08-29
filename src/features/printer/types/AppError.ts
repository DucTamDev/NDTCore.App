export const AppErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NO_AVAILABLE_PRINTER: 'NO_AVAILABLE_PRINTER',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',

  PRINTER_NOT_FOUND: 'PRINTER_NOT_FOUND',
  PRINTER_ALREADY_EXISTS: 'PRINTER_ALREADY_EXISTS',
  PRINTER_CONNECTION_FAILED: 'PRINTER_CONNECTION_FAILED',
  PRINTER_CONNECTION_TIMEOUT: 'PRINTER_CONNECTION_TIMEOUT',
  PRINTER_NOT_CONNECTED: 'PRINTER_NOT_CONNECTED',
  PRINTER_PROTOCOL_UNKNOWN: 'PRINTER_PROTOCOL_UNKNOWN',
  PRINTER_UNSUPPORTED_CONNECTION: 'PRINTER_UNSUPPORTED_CONNECTION',
  PRINTER_BUSY: 'PRINTER_BUSY',
  PRINTER_WRITE_FAILED: 'PRINTER_WRITE_FAILED',

  TSPL_IMAGE_REQUIRED: 'TSPL_IMAGE_REQUIRED',
  TSPL_IMAGE_INVALID: 'TSPL_IMAGE_INVALID',
  TSPL_IMAGE_TOO_LARGE: 'TSPL_IMAGE_TOO_LARGE',
  TSPL_FONT_NOT_INSTALLED: 'TSPL_FONT_NOT_INSTALLED',
  TSPL_FONT_INSTALL_FAILED: 'TSPL_FONT_INSTALL_FAILED',
  TSPL_FONT_INVALID: 'TSPL_FONT_INVALID',
  TSPL_RENDER_MODE_UNSUPPORTED: 'TSPL_RENDER_MODE_UNSUPPORTED',
  TSPL_ELEMENT_UNSUPPORTED: 'TSPL_ELEMENT_UNSUPPORTED',
} as const;

export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];

export interface AppError {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
}

export class AppErrorException extends Error {
  code: AppErrorCode;
  cause?: unknown;

  constructor(error: AppError) {
    super(error.message);
    this.name = 'AppErrorException';
    this.code = error.code;
    this.cause = error.cause;
  }
}

/** Trả `'UNKNOWN_ERROR'` nếu không phải `AppErrorException` (vd lỗi native module ném thẳng). */
export const errorCodeOf = (error: unknown): AppErrorCode => (error instanceof AppErrorException ? error.code : AppErrorCode.UNKNOWN_ERROR);
