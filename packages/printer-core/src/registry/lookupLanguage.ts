import { UnsupportedLanguageError, type PrinterLanguage, type PrinterLanguageDefinition } from '../core';
import { LANGUAGE_REGISTRY } from './LanguageRegistry';

/** Năng lực registry được tra cứu — đúng 4 giá trị mà các file dispatch trong `registry/` truyền vào. */
export type LanguageCapability = 'compiler' | 'parser' | 'validator' | 'preview renderer';

/**
 * Theo kiểu thì registry luôn đủ ngôn ngữ, nhưng `language` có thể đến từ dữ liệu chưa kiểm tra kiểu (JSON,
 * input người dùng) nên vẫn phải báo lỗi rõ thay vì văng `undefined`.
 */
export function lookupLanguage(
  language: PrinterLanguage,
  capability: LanguageCapability,
): PrinterLanguageDefinition {
  const definition: PrinterLanguageDefinition | undefined = LANGUAGE_REGISTRY[language];
  if (!definition) throw new UnsupportedLanguageError(language, capability);
  return definition;
}
