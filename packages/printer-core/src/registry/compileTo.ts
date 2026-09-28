import type { CompileResult, PrinterFeatures, PrinterLanguage } from '../core';
import type { ResolvedPrintDocument } from '../document';
import { lookupLanguage } from './lookupLanguage';

/** Compile document sang ngôn ngữ `language` cho máy in có năng lực `features`. */
export function compileTo(
  language: PrinterLanguage,
  document: ResolvedPrintDocument,
  features?: PrinterFeatures,
): CompileResult<string | Uint8Array> {
  return lookupLanguage(language, 'compiler').compiler.compile(document, features);
}
