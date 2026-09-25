import type { ResolvedPrintDocument } from '../document';

/** The subset of `PrinterProfile.features` a compiler needs to choose how to encode text — never the full printer profile. */
export interface TextEncodingOptions {
  nativeUtf8?: boolean;
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
 * `encoding` is part of the contract so every language compiler can be invoked
 * through one uniform call shape. Only `EscPosCompiler` acts on it today (code
 * page / text-encoding selection); the rest accept and ignore it until their
 * protocol has a grounded encoding-selection command to drive from it.
 */
export interface PrintCompiler<TOutput = string | Uint8Array> {
  compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): CompileResult<TOutput>;
}
