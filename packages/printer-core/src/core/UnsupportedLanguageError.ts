import type { PrinterLanguage } from './PrinterLanguage';

/** Ném ra khi được yêu cầu xử lý 1 ngôn ngữ không có trong registry. */
export class UnsupportedLanguageError extends Error {
  /** Ngôn ngữ không được hỗ trợ. */
  readonly language: PrinterLanguage;

  constructor(language: PrinterLanguage, capability: string) {
    super(`printer-core has no ${capability} for language "${language}" yet.`);
    this.name = 'UnsupportedLanguageError';
    this.language = language;
  }
}
