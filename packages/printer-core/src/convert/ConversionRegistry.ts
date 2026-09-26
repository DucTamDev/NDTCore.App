import type { CompileResult, PrinterLanguage } from '../core';
import type { PrintElement, ResolvedPrintDocument } from '../document';
import { decodeEscPos, EscPosCompiler, parseTSPL, TsplCompiler } from '../language';

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

function toText(source: string | Uint8Array): string {
  return typeof source === 'string' ? source : new TextDecoder().decode(source);
}

/**
 * ESC/POS nhận `string` theo quy ước 1 ký tự = 1 byte (0-255), giống `EscPosValidator`, để output byte của chính
 * `convert()` đọc ngược lại được; giải mã qua UTF-8 sẽ làm hỏng mọi byte >= 0x80.
 */
function toBytes(source: string | Uint8Array): Uint8Array {
  if (source instanceof Uint8Array) return source;
  const bytes = new Uint8Array(source.length);
  // eslint-disable-next-line no-bitwise -- giữ đúng 1 byte cho mỗi ký tự
  for (let i = 0; i < source.length; i++) bytes[i] = source.charCodeAt(i) & 0xff;
  return bytes;
}

/** Parse/compile của từng ngôn ngữ, dùng khi chuyển lệnh từ ngôn ngữ này sang ngôn ngữ khác. */
export const ConversionRegistry: Record<PrinterLanguage, ConversionRegistryEntry> = {
  tspl: {
    parse: (source) => {
      const result = parseTSPL(toText(source));
      return {
        elements: result.elements,
        widthDots: result.widthDots,
        heightDots: result.heightDots,
        warnings: result.warnings,
      };
    },
    compile: (document) => new TsplCompiler().compile(document),
  },
  escpos: {
    parse: (source) => {
      const result = decodeEscPos(toBytes(source));
      return { elements: result.elements, warnings: result.warnings };
    },
    compile: (document) => new EscPosCompiler().compile(document),
  },
};
