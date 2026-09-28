import { UnsupportedLanguageError, type PrinterLanguage, type PrinterLanguageDefinition } from '../core';
import { LANGUAGE_REGISTRY } from './LanguageRegistry';

/**
 * Theo kiểu thì registry luôn đủ ngôn ngữ, nhưng `language` có thể đến từ dữ liệu chưa kiểm tra kiểu (JSON,
 * input người dùng) nên vẫn phải báo lỗi rõ thay vì văng `undefined`.
 */
export function lookupLanguage(language: PrinterLanguage, capability: string): PrinterLanguageDefinition {
  const definition: PrinterLanguageDefinition | undefined = LANGUAGE_REGISTRY[language];
  if (!definition) throw new UnsupportedLanguageError(language, capability);
  return definition;
}
