import type { PrintCompiler } from './PrintCompiler';
import type { PrintParser } from './PrintParser';
import type { PrintValidation } from './PrintValidation';
import type { PrintPreview } from './PrintPreview';
import type { PrinterLanguage } from './PrinterLanguage';

/**
 * One `PrinterLanguage`'s full capability set, bundled together so
 * `LanguageRegistry.ts` can build one `Record<PrinterLanguage, ...>` instead
 * of four parallel switch statements — a language missing a capability is
 * now a compile-time error (an incomplete `Record`) instead of a runtime
 * `UnsupportedLanguageError` only surfacing when that exact combination is
 * called. Mirrors `convert/ConversionRegistry.ts`'s registry-over-switch
 * shape, extended here to cover validator and preview too.
 */
export interface PrinterLanguageDefinition {
  readonly language: PrinterLanguage;
  readonly compiler: PrintCompiler<string | Uint8Array>;
  readonly parser: PrintParser<{ commands: unknown[]; warnings: string[] }>;
  readonly validator: PrintValidation;
  readonly previewRenderer: PrintPreview;
}
