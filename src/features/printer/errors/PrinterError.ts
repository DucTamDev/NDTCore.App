import type { PrinterErrorCode } from './PrinterErrorCode';

/** Lỗi máy in dạng dữ liệu, lưu được vào job in và trả về cho UI. */
export interface PrinterError {
  code: PrinterErrorCode;

  /** Câu thông báo tiếng Việt cho người dùng. */
  message: string;

  /** Lỗi gốc (vd lỗi native) để chẩn đoán. */
  cause?: unknown;
}
