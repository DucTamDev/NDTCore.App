import type { PrinterLanguage } from './PrinterLanguage';

/**
 * Thrown by printer-core's language dispatch (`compileTo`/`parseFrom`/
 * `validateFor`/`previewFor` in `LanguageDispatch.ts`) when asked to handle
 * a `PrinterLanguage` that has no compiler/parser/validator/preview
 * implementation in this package yet. Defined locally, not imported from
 * elsewhere in the app, since `packages/printer-core` is framework-agnostic
 * and self-contained — it does not depend on any app-specific code.
 */
export class UnsupportedLanguageError extends Error {
  readonly language: PrinterLanguage;

  constructor(language: PrinterLanguage, capability: string) {
    super(`printer-core has no ${capability} for language "${language}" yet.`);
    this.name = 'UnsupportedLanguageError';
    this.language = language;
  }
}
