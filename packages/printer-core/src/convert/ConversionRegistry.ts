import type { CompileResult, PrinterLanguage } from '../core';
import type { PrintElement, ResolvedPrintDocument } from '../document';
import { EscPosCompiler, EscPosParser, TsplCompiler, TsplParser } from '../language';

/** Những gì parser của 1 ngôn ngữ dựng lại được từ lệnh máy in. */
export interface ParsedSource {
  /** Element dựng lại từ lệnh. */
  elements: PrintElement[];

  /** Khổ ngang (dots); bỏ trống khi ngôn ngữ không có lệnh khai báo khổ, để phân biệt với giá trị 0 thật. */
  widthDots?: number;

  /** Chiều dài tem (dots); bỏ trống khi ngôn ngữ không có lệnh khai báo, để phân biệt với giá trị 0 thật. */
  heightDots?: number;

  /** Lệnh không nhận diện được hoặc dữ liệu hỏng gặp khi parse. */
  warnings: string[];
}

/** Cặp parse/compile của 1 ngôn ngữ mà `convert()` tra cứu. */
export interface ConversionRegistryEntry {
  /** Đọc lệnh máy in thành element. */
  parse: (source: string | Uint8Array) => ParsedSource;

  /** Compile document thành lệnh của ngôn ngữ này. */
  compile: (document: ResolvedPrintDocument) => CompileResult<string | Uint8Array>;
}

/** Parse/compile của từng ngôn ngữ, dùng khi chuyển lệnh từ ngôn ngữ này sang ngôn ngữ khác. */
export const ConversionRegistry: Record<PrinterLanguage, ConversionRegistryEntry> = {
  tspl: {
    parse: (source) => new TsplParser().parse(source),
    compile: (document) => new TsplCompiler().compile(document),
  },
  escpos: {
    parse: (source) => new EscPosParser().parse(source),
    compile: (document) => new EscPosCompiler().compile(document),
  },
};
