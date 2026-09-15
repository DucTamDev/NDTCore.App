import type { ResolvedPrintDocument } from '../document';
import type { PrinterProfile } from '../profile';
import type { ValidationResult } from '../validation/ValidationResult';
import { TscCompiler } from '../compiler/tsc/TscCompiler';
import { TscParser } from '../parser/tsc/TscParser';
import { TscValidator } from '../validation/tsc/TscValidator';
import { TscPreviewRenderer } from '../preview/languages/TscPreviewRenderer';
import { EscPosCompiler } from '../compiler/escpos/EscPosCompiler';
import { EscPosParser } from '../parser/escpos/EscPosParser';
import { EscPosValidator } from '../validation/escpos/EscPosValidator';
import { EscPosPreviewRenderer } from '../preview/languages/EscPosPreviewRenderer';
import { ZplCompiler } from '../compiler/zpl/ZplCompiler';
import { ZplParser } from '../parser/zpl/ZplParser';
import { ZplValidator } from '../validation/zpl/ZplValidator';
import { ZplPreviewRenderer } from '../preview/languages/ZplPreviewRenderer';
import type { PrinterLanguage } from './PrinterLanguage';
import { UnsupportedLanguageError } from './PrinterCoreError';

/**
 * Routes a `PrinterLanguage` to its compiler and runs it. "tsc" (Task 9),
 * "escpos" (Task 8), and "zpl" (Phase 2 Task 1) have a real compiler in this
 * package — every other language throws `UnsupportedLanguageError` (Phase 2
 * per the porting plan: EPL, CPCL, DPL, SBPL, Star PRNT, IPL).
 */
export function compileTo(language: PrinterLanguage, document: ResolvedPrintDocument, profile?: PrinterProfile): string | Uint8Array {
  switch (language) {
    case 'tsc':
      return new TscCompiler().compile(document, profile);
    case 'escpos':
      return new EscPosCompiler().compile(document, profile);
    case 'zpl':
      return new ZplCompiler().compile(document, profile);
    default:
      throw new UnsupportedLanguageError(language, 'compiler');
  }
}

/** Routes a `PrinterLanguage` to its parser. `source` must be the shape that language's compiler produces (`string` for TSC/ZPL, `Uint8Array` for ESC/POS). */
export function parseFrom(language: PrinterLanguage, source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
  switch (language) {
    case 'tsc':
      return new TscParser().parse(source);
    case 'escpos':
      return new EscPosParser().parse(source as Uint8Array);
    case 'zpl':
      return new ZplParser().parse(source);
    default:
      throw new UnsupportedLanguageError(language, 'parser');
  }
}

/** Routes a `PrinterLanguage` to its validator. */
export function validateFor(language: PrinterLanguage, source: string): ValidationResult {
  switch (language) {
    case 'tsc':
      return new TscValidator().validate(source);
    case 'escpos':
      return new EscPosValidator().validate(source);
    case 'zpl':
      return new ZplValidator().validate(source);
    default:
      throw new UnsupportedLanguageError(language, 'validator');
  }
}

/** Routes a `PrinterLanguage` to its SVG preview renderer. */
export function previewFor(language: PrinterLanguage, document: ResolvedPrintDocument): string {
  switch (language) {
    case 'tsc':
      return new TscPreviewRenderer().preview(document);
    case 'escpos':
      return new EscPosPreviewRenderer().preview(document);
    case 'zpl':
      return new ZplPreviewRenderer().preview(document);
    default:
      throw new UnsupportedLanguageError(language, 'preview renderer');
  }
}
