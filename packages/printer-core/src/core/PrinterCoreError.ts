import type { PrinterLanguage } from './PrinterLanguage';

/**
 * Thrown by printer-core's language dispatch (`compileTo`/`parseFrom`/
 * `validateFor`/`previewFor` in `LanguageDispatch.ts`) when asked to handle
 * a `PrinterLanguage` that has no compiler/parser/validator/preview
 * implementation in this package yet. Defined locally — rather than reusing
 * `src/features/printer/errors/PrinterError.ts`'s `PrinterErrorException` —
 * because `packages/printer-core` is framework-agnostic and must not import
 * from `src/features/printer`.
 */
export class UnsupportedLanguageError extends Error {
  readonly language: PrinterLanguage;

  constructor(language: PrinterLanguage, capability: string) {
    super(`printer-core has no ${capability} for language "${language}" yet.`);
    this.name = 'UnsupportedLanguageError';
    this.language = language;
  }
}
