import type { TextEncodingOptions } from '../../core';
import { encodeTextForPrinter } from '../../encoding';

/**
 * Encoding fallback khi `EscPosCompiler.compile()` được gọi không kèm
 * encoding options — CP437 là code page mặc định nhà máy của ESC/POS trên
 * hầu hết máy in hoá đơn tương thích Epson.
 */
const DEFAULT_ENCODING = { nativeUtf8: false, codePages: [437] };

/**
 * Encode text cho output ESC/POS theo code page đã khai báo (hoặc UTF-8 thô
 * khi `encoding.nativeUtf8` được bật). Thay thế cho `ByteBuffer.writeText()`
 * của portakal, vốn luôn ghi UTF-8 thô bất kể profile.
 */
export function encodeEscPosText(text: string, encoding?: TextEncodingOptions): Uint8Array {
  const nativeUtf8 = encoding?.nativeUtf8 ?? DEFAULT_ENCODING.nativeUtf8;
  const codePages = encoding?.codePages ?? DEFAULT_ENCODING.codePages;
  return encodeTextForPrinter(text, { nativeUtf8, codePages }).bytes;
}
