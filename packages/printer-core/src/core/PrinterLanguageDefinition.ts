import type { PrintCompiler } from './PrintCompiler';
import type { ParsedCommands, PrintParser } from './PrintParser';
import type { PrintValidation } from './PrintValidation';
import type { PrintPreview } from './PrintPreview';
import type { PrinterLanguage } from './PrinterLanguage';

/** Đủ bộ xử lý của 1 ngôn ngữ, gom lại để registry khai báo mỗi ngôn ngữ đúng 1 lần. */
export interface PrinterLanguageDefinition {
  /** Ngôn ngữ mà bộ xử lý này phục vụ. */
  readonly language: PrinterLanguage;

  /** Biên dịch document thành lệnh máy in. */
  readonly compiler: PrintCompiler<string | Uint8Array>;

  /** Đọc ngược lệnh máy in thành danh sách lệnh + cảnh báo. */
  readonly parser: PrintParser<ParsedCommands>;

  /** Kiểm tra cú pháp chuỗi lệnh. */
  readonly validator: PrintValidation;

  /** Vẽ preview SVG của document. */
  readonly previewRenderer: PrintPreview;
}
