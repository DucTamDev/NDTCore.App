export const AppErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  UNSUPPORTED_CONNECTION: 'UNSUPPORTED_CONNECTION',
  PRINT_ERROR: 'PRINT_ERROR',
  ENCODING_FAILED: 'ENCODING_FAILED',
  NO_AVAILABLE_PRINTER: 'NO_AVAILABLE_PRINTER',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
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
