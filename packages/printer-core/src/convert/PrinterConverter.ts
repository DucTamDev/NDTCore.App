import { UnsupportedLanguageError, type PrinterLanguage } from '../core';
import type { ResolvedPrintDocument } from '../document';
import { ConversionRegistry, type ConversionRegistryEntry } from './ConversionRegistry';
import type { ConversionResult } from './ConversionResult';

/** Khổ tem mặc định (dots) khi lệnh nguồn không khai báo khổ, VD ESC/POS không có lệnh khổ giấy. */
const DEFAULT_WIDTH_DOTS = 320;
const DEFAULT_HEIGHT_DOTS = 240;

const DEFAULT_DPI = 203;
const DEFAULT_GAP_DOTS = 24;
const DEFAULT_SPEED = 4;
const DEFAULT_DENSITY = 8;
const DEFAULT_COPIES = 1;

/** Đổi byte đã compile thành chuỗi 1 ký tự = 1 byte, theo quy ước của `ConversionResult.output`. */
function bytesToBinaryString(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function lookup(language: PrinterLanguage, capability: 'conversion source' | 'conversion target'): ConversionRegistryEntry {
  const entry: ConversionRegistryEntry | undefined = ConversionRegistry[language];
  if (!entry) throw new UnsupportedLanguageError(language, capability);
  return entry;
}

/**
 * Chuyển lệnh máy in từ ngôn ngữ `from` sang `to`: parse thành `PrintElement[]`, gói vào document với thiết lập
 * mặc định, rồi compile sang ngôn ngữ đích.
 */
export function convert(source: string, from: PrinterLanguage, to: PrinterLanguage): ConversionResult {
  const sourceEntry = lookup(from, 'conversion source');
  const targetEntry = lookup(to, 'conversion target');

  const parsed = sourceEntry.parse(source);

  const document: ResolvedPrintDocument = {
    widthDots: parsed.widthDots ?? DEFAULT_WIDTH_DOTS,
    heightDots: parsed.heightDots ?? DEFAULT_HEIGHT_DOTS,
    dpi: DEFAULT_DPI,
    gapDots: DEFAULT_GAP_DOTS,
    speed: DEFAULT_SPEED,
    density: DEFAULT_DENSITY,
    direction: 'forward',
    copies: DEFAULT_COPIES,
    elements: parsed.elements,
  };

  const compiled = targetEntry.compile(document);
  const output = typeof compiled.output === 'string' ? compiled.output : bytesToBinaryString(compiled.output);

  return { output, elements: parsed.elements, warnings: [...parsed.warnings, ...compiled.warnings] };
}
