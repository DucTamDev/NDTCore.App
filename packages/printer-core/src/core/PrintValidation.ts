import type { ValidationResult } from '../validation';

/** Kiểm tra cú pháp chuỗi lệnh máy in trước khi gửi đi. */
export interface PrintValidation {
  validate(source: string): ValidationResult;
}
