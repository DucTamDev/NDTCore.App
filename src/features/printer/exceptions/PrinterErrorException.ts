import type { PrinterError } from '../errors/PrinterError';
import { PrinterErrorCode } from '../errors/PrinterErrorCode';

/** Exception mang `PrinterError`, ném từ tầng máy in để nơi gọi đọc được `code`. */
export class PrinterErrorException extends Error {
  /** Mã lỗi ổn định của lỗi này. */
  code: PrinterErrorCode;

  /** Lỗi gốc (vd lỗi native) để chẩn đoán. */
  cause?: unknown;

  constructor(error: PrinterError) {
    super(error.message);
    this.name = 'PrinterErrorException';
    this.code = error.code;
    this.cause = error.cause;
  }
}

/** Trả `'UNKNOWN_ERROR'` nếu không phải `PrinterErrorException` (vd lỗi native module ném thẳng). */
export const errorCodeOf = (error: unknown): PrinterErrorCode =>
  error instanceof PrinterErrorException ? error.code : PrinterErrorCode.UNKNOWN_ERROR;
