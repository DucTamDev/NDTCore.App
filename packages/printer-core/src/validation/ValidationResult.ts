import type { ValidationIssue } from './ValidationIssue';

/** Kết quả kiểm tra lệnh máy in. */
export interface ValidationResult {
  /** Không có lỗi mức `error`. */
  valid: boolean;

  /** Mọi vấn đề tìm thấy. */
  issues: ValidationIssue[];

  /** Số vấn đề mức `error`. */
  errors: number;

  /** Số vấn đề mức `warning`. */
  warnings: number;

  /** Số vấn đề mức `info`. */
  infos: number;
}
