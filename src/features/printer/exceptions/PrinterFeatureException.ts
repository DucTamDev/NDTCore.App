import type { ErrorCode } from '../errors/ErrorCode';
import { PrintErrorCode } from '../errors/PrintErrorCode';

/** Nội dung một exception: mã lỗi thuộc bộ mã của lớp con, thông báo và lỗi gốc. */
export interface ExceptionDetail<TCode extends ErrorCode> {
  code: TCode;

  /** Câu thông báo tiếng Việt cho người dùng. */
  message: string;

  /** Lỗi gốc (vd lỗi native) để chẩn đoán. */
  cause?: unknown;
}

/** Lớp nền của mọi exception feature máy in, để nơi gọi bắt chung và đọc `code` bất kể tầng nào ném. */
export abstract class PrinterFeatureException<TCode extends ErrorCode = ErrorCode> extends Error {
  /** Mã lỗi ổn định của lỗi này. */
  code: TCode;

  /** Lỗi gốc (vd lỗi native) để chẩn đoán. */
  cause?: unknown;

  protected constructor(name: string, detail: ExceptionDetail<TCode>) {
    super(detail.message);
    this.name = name;
    this.code = detail.code;
    this.cause = detail.cause;
  }
}

/** Lỗi không phải exception của feature (vd lỗi lập trình) coi là `UNKNOWN_ERROR`. */
export const errorCodeOf = (error: unknown): ErrorCode =>
  error instanceof PrinterFeatureException ? error.code : PrintErrorCode.UNKNOWN_ERROR;
