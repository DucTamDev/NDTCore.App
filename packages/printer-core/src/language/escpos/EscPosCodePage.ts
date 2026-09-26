import type { PrinterFeatures } from '../../core';
import { encodeTextForPrinter } from '../../encoding';

/** CP437 là code page mặc định nhà máy của ESC/POS trên hầu hết máy in hoá đơn tương thích Epson. */
const DEFAULT_ENCODING = { nativeUtf8: false, codePages: [437] };

export function encodeEscPosText(text: string, features?: PrinterFeatures): Uint8Array {
  const nativeUtf8 = features?.nativeUtf8 ?? DEFAULT_ENCODING.nativeUtf8;
  const codePages = features?.codePages ?? DEFAULT_ENCODING.codePages;
  return encodeTextForPrinter(text, { nativeUtf8, codePages }).bytes;
}
