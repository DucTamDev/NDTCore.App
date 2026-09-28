import type { PrinterLanguage, PrintParseResult } from '../core';
import { lookupLanguage } from './lookupLanguage';

/** ESC/POS nhận byte hoặc chuỗi 1 ký tự = 1 byte; TSPL nhận chuỗi hoặc byte UTF-8. */
export function parseFrom(language: PrinterLanguage, source: string | Uint8Array): PrintParseResult {
  return lookupLanguage(language, 'parser').parser.parse(source);
}
