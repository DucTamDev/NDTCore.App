export const PrinterErrorCode = {
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

  /** Dùng chung mọi protocol có bitmap mode — mô tả trạng thái `documents.image`, không phải lỗi riêng TSPL. */
  IMAGE_REQUIRED: 'IMAGE_REQUIRED',
  IMAGE_INVALID: 'IMAGE_INVALID',
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
  TSPL_RENDER_MODE_UNSUPPORTED: 'TSPL_RENDER_MODE_UNSUPPORTED',
  TSPL_ELEMENT_UNSUPPORTED: 'TSPL_ELEMENT_UNSUPPORTED',
} as const;

export type PrinterErrorCode = (typeof PrinterErrorCode)[keyof typeof PrinterErrorCode];

export interface PrinterError {
  code: PrinterErrorCode;
  message: string;
  cause?: unknown;
}

export class PrinterErrorException extends Error {
  code: PrinterErrorCode;
  cause?: unknown;

  constructor(error: PrinterError) {
    super(error.message);
    this.name = 'PrinterErrorException';
    this.code = error.code;
    this.cause = error.cause;
  }
}

/** Trả `'UNKNOWN_ERROR'` nếu không phải `PrinterErrorException` (vd lỗi native module ném thẳng). */
export const errorCodeOf = (error: unknown): PrinterErrorCode => (error instanceof PrinterErrorException ? error.code : PrinterErrorCode.UNKNOWN_ERROR);
