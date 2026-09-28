import type { PrinterLanguage } from '../core';
import type { ResolvedPrintDocument } from '../document';
import { lookupLanguage } from './lookupLanguage';

/** Vẽ preview SVG của document theo ngôn ngữ `language`. */
export function previewFor(language: PrinterLanguage, document: ResolvedPrintDocument): string {
  return lookupLanguage(language, 'preview renderer').previewRenderer.preview(document);
}
