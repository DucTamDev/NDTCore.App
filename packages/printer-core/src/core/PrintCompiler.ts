import type { ResolvedPrintDocument } from '../document';

/** Phần thông tin mã hoá chữ lấy từ `PrinterProfile.features` — compiler không cần cả profile. */
export interface TextEncodingOptions {
  /** Máy in nhận thẳng UTF-8, không cần đổi chữ sang code page. */
  nativeUtf8?: boolean;

  /** Code page máy in hỗ trợ, theo số hiệu code page (VD 437, 1258). */
  codePages?: number[];
}

/** Kết quả compile: lệnh máy in + cảnh báo về những gì máy in không làm được. */
export interface CompileResult<TOutput> {
  /** Chuỗi lệnh (ngôn ngữ dạng text) hoặc byte (ESC/POS, Star PRNT) để gửi tới máy in. */
  readonly output: TOutput;

  /** Field/element bị bỏ qua hoặc gộp vì ngôn ngữ không hỗ trợ; mỗi cảnh báo xuất hiện 1 lần. */
  readonly warnings: readonly string[];
}

/**
 * Biên dịch document thành lệnh máy in. Hiện chỉ ESC/POS dùng `encoding` để chọn code page; ngôn ngữ khác
 * vẫn nhận tham số này để mọi compiler được gọi theo cùng 1 chữ ký.
 */
export interface PrintCompiler<TOutput = string | Uint8Array> {
  compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): CompileResult<TOutput>;
}
