import type { ResolvedPrintDocument } from '../document';
import type { PrinterProfile } from '../profile';
import type { ValidationResult } from '../validation/ValidationResult';
import type { PrinterLanguage } from './PrinterLanguage';
import type { PrinterLanguageDefinition } from './PrinterLanguageDefinition';
import { LANGUAGE_REGISTRY } from './LanguageRegistry';
import { UnsupportedLanguageError } from './PrinterCoreError';

/**
 * `LANGUAGE_REGISTRY` is a `Record<PrinterLanguage, ...>`, so this lookup
 * can never actually miss for a real `PrinterLanguage` value — the check
 * stays because `language` may arrive from outside type-checked code (e.g.
 * an untyped string from JSON or user input), the same defensive shape
 * `PrinterConverter.ts`'s own `lookup()` uses.
 */
function lookup(language: PrinterLanguage, capability: string): PrinterLanguageDefinition {
  const definition = LANGUAGE_REGISTRY[language];
  if (!definition) throw new UnsupportedLanguageError(language, capability);
  return definition;
}

/**
 * Routes a `PrinterLanguage` to its compiler and runs it. Every one of the
 * nine languages — tsc, escpos, zpl, epl, cpcl, dpl, sbpl, starprnt, ipl —
 * has a real compiler in this package, so there is no stub branch here.
 */
export function compileTo(language: PrinterLanguage, document: ResolvedPrintDocument, profile?: PrinterProfile): string | Uint8Array {
  return lookup(language, 'compiler').compiler.compile(document, profile);
}

/** Routes a `PrinterLanguage` to its parser. `source` must be the shape that language's compiler produces: `string` for tsc/zpl/epl/cpcl/dpl/sbpl/ipl, `Uint8Array` for escpos/starprnt. */
export function parseFrom(language: PrinterLanguage, source: string | Uint8Array): { commands: unknown[]; warnings: string[] } {
  return lookup(language, 'parser').parser.parse(source);
}

/** Routes a `PrinterLanguage` to its validator. */
export function validateFor(language: PrinterLanguage, source: string): ValidationResult {
  return lookup(language, 'validator').validator.validate(source);
}

/** Routes a `PrinterLanguage` to its SVG preview renderer. */
export function previewFor(language: PrinterLanguage, document: ResolvedPrintDocument): string {
  return lookup(language, 'preview renderer').previewRenderer.preview(document);
}
