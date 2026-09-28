import type { ResolvedPrintDocument } from '../document';
import type { CompileResult } from './CompileResult';
import type { PrinterFeatures } from './PrinterFeatures';

/**
 * Biên dịch document thành lệnh máy in. Hiện chỉ ESC/POS đọc `features` (chọn code page); ngôn ngữ khác vẫn
 * nhận tham số này để mọi compiler được gọi theo cùng 1 chữ ký.
 */
export interface PrintCompiler<TOutput = string | Uint8Array> {
  compile(document: ResolvedPrintDocument, features?: PrinterFeatures): CompileResult<TOutput>;
}
