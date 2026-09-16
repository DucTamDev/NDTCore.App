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
import { EplCompiler } from '../compiler/epl/EplCompiler';
import { EplParser } from '../parser/epl/EplParser';
import { EplValidator } from '../validation/epl/EplValidator';
import { EplPreviewRenderer } from '../preview/languages/EplPreviewRenderer';
import { CpclCompiler } from '../compiler/cpcl/CpclCompiler';
import { CpclParser } from '../parser/cpcl/CpclParser';
import { CpclValidator } from '../validation/cpcl/CpclValidator';
import { CpclPreviewRenderer } from '../preview/languages/CpclPreviewRenderer';
import { DplCompiler } from '../compiler/dpl/DplCompiler';
import { DplParser } from '../parser/dpl/DplParser';
import { DplValidator } from '../validation/dpl/DplValidator';
import { DplPreviewRenderer } from '../preview/languages/DplPreviewRenderer';
import { SbplCompiler } from '../compiler/sbpl/SbplCompiler';
import { SbplParser } from '../parser/sbpl/SbplParser';
import { SbplValidator } from '../validation/sbpl/SbplValidator';
import { SbplPreviewRenderer } from '../preview/languages/SbplPreviewRenderer';
import { StarPrntCompiler } from '../compiler/starprnt/StarPrntCompiler';
import { StarPrntParser } from '../parser/starprnt/StarPrntParser';
import { StarPrntValidator } from '../validation/starprnt/StarPrntValidator';
import { StarPrntPreviewRenderer } from '../preview/languages/StarPrntPreviewRenderer';
import { IplCompiler } from '../compiler/ipl/IplCompiler';
import { IplParser } from '../parser/ipl/IplParser';
import { IplValidator } from '../validation/ipl/IplValidator';
import { IplPreviewRenderer } from '../preview/languages/IplPreviewRenderer';
import type { PrinterLanguage } from './PrinterLanguage';
import { UnsupportedLanguageError } from './PrinterCoreError';

/**
 * Routes a `PrinterLanguage` to its compiler and runs it. "tsc" (Task 9),
 * "escpos" (Task 8), "zpl" (Phase 2 Task 1), "epl" (Phase 2 Task 2), "cpcl"
 * (Phase 2 Task 3), "dpl" (Phase 2 Task 4), "sbpl" (Phase 2 Task 5),
 * "starprnt" (Phase 2 Task 6), and "ipl" (Phase 2 Task 7) have a real
 * compiler in this package — Phase 2 is now complete, so every
 * `PrinterLanguage` has a real implementation.
 */
export function compileTo(language: PrinterLanguage, document: ResolvedPrintDocument, profile?: PrinterProfile): string | Uint8Array {
  switch (language) {
    case 'tsc':
      return new TscCompiler().compile(document, profile);
    case 'escpos':
      return new EscPosCompiler().compile(document, profile);
    case 'zpl':
      return new ZplCompiler().compile(document, profile);
    case 'epl':
      return new EplCompiler().compile(document, profile);
    case 'cpcl':
      return new CpclCompiler().compile(document, profile);
    case 'dpl':
      return new DplCompiler().compile(document, profile);
    case 'sbpl':
      return new SbplCompiler().compile(document, profile);
    case 'starprnt':
      return new StarPrntCompiler().compile(document);
    case 'ipl':
      return new IplCompiler().compile(document, profile);
    default:
      throw new UnsupportedLanguageError(language, 'compiler');
  }
}

/** Routes a `PrinterLanguage` to its parser. `source` must be the shape that language's compiler produces (`string` for TSC/ZPL/EPL/CPCL, `Uint8Array` for ESC/POS). */
export function parseFrom(language: PrinterLanguage, source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
  switch (language) {
    case 'tsc':
      return new TscParser().parse(source);
    case 'escpos':
      return new EscPosParser().parse(source as Uint8Array);
    case 'zpl':
      return new ZplParser().parse(source);
    case 'epl':
      return new EplParser().parse(source);
    case 'cpcl':
      return new CpclParser().parse(source);
    case 'dpl':
      return new DplParser().parse(source);
    case 'sbpl':
      return new SbplParser().parse(source);
    case 'starprnt':
      return new StarPrntParser().parse(source);
    case 'ipl':
      return new IplParser().parse(source);
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
    case 'epl':
      return new EplValidator().validate(source);
    case 'cpcl':
      return new CpclValidator().validate(source);
    case 'dpl':
      return new DplValidator().validate(source);
    case 'sbpl':
      return new SbplValidator().validate(source);
    case 'starprnt':
      return new StarPrntValidator().validate(source);
    case 'ipl':
      return new IplValidator().validate(source);
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
    case 'epl':
      return new EplPreviewRenderer().preview(document);
    case 'cpcl':
      return new CpclPreviewRenderer().preview(document);
    case 'dpl':
      return new DplPreviewRenderer().preview(document);
    case 'sbpl':
      return new SbplPreviewRenderer().preview(document);
    case 'starprnt':
      return new StarPrntPreviewRenderer().preview(document);
    case 'ipl':
      return new IplPreviewRenderer().preview(document);
    default:
      throw new UnsupportedLanguageError(language, 'preview renderer');
  }
}
