import type { ResolvedPrintDocument } from '../document';
import type { ValidationResult } from '../validation';
import type { CompileResult } from './PrintCompiler';
import type { PrinterFeatures } from './PrinterFeatures';
import type { ParsedCommands } from './PrintParser';
import type { PrinterLanguage } from './PrinterLanguage';
import type { PrinterLanguageDefinition } from './PrinterLanguageDefinition';
import { LANGUAGE_REGISTRY } from './LanguageRegistry';
import { UnsupportedLanguageError } from './PrinterCoreError';

/**
 * Theo kiểu thì registry luôn đủ ngôn ngữ, nhưng `language` có thể đến từ dữ liệu chưa kiểm tra kiểu (JSON,
 * input người dùng) nên vẫn phải báo lỗi rõ thay vì văng `undefined`.
 */
function lookup(language: PrinterLanguage, capability: string): PrinterLanguageDefinition {
  const definition: PrinterLanguageDefinition | undefined = LANGUAGE_REGISTRY[language];
  if (!definition) throw new UnsupportedLanguageError(language, capability);
  return definition;
}

/** Compile document sang ngôn ngữ `language` cho máy in có năng lực `features`. */
export function compileTo(
  language: PrinterLanguage,
  document: ResolvedPrintDocument,
  features?: PrinterFeatures,
): CompileResult<string | Uint8Array> {
  return lookup(language, 'compiler').compiler.compile(document, features);
}

/** `source` phải đúng dạng compiler của ngôn ngữ đó sinh ra: byte cho ESC/POS và Star PRNT, chuỗi cho còn lại. */
export function parseFrom(language: PrinterLanguage, source: string | Uint8Array): ParsedCommands {
  return lookup(language, 'parser').parser.parse(source);
}

/** Kiểm tra cú pháp chuỗi lệnh của ngôn ngữ `language`. */
export function validateFor(language: PrinterLanguage, source: string): ValidationResult {
  return lookup(language, 'validator').validator.validate(source);
}

/** Vẽ preview SVG của document theo ngôn ngữ `language`. */
export function previewFor(language: PrinterLanguage, document: ResolvedPrintDocument): string {
  return lookup(language, 'preview renderer').previewRenderer.preview(document);
}
