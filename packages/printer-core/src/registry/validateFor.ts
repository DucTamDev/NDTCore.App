import type { PrinterLanguage } from '../core';
import type { ValidationResult } from '../validation';
import { lookupLanguage } from './lookupLanguage';

/** Kiểm tra cú pháp chuỗi lệnh của ngôn ngữ `language`. */
export function validateFor(language: PrinterLanguage, source: string): ValidationResult {
  return lookupLanguage(language, 'validator').validator.validate(source);
}
