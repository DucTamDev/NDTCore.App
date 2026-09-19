import type { TextEncodingOptions } from '../../core';
import { encodeTextForPrinter } from '../../encoding';

/**
 * Fallback encoding used when EscPosCompiler.compile() is called without
 * encoding options — CP437 is the ESC/POS factory-default code page on
 * virtually every Epson-compatible receipt printer.
 */
const DEFAULT_ENCODING = { nativeUtf8: false, codePages: [437] };

/**
 * Encode text for ESC/POS output via the declared code page (or raw UTF-8
 * when `encoding.nativeUtf8` is set). Replaces portakal's
 * `ByteBuffer.writeText()`, which always wrote naive UTF-8 regardless of profile.
 */
export function encodeEscPosText(text: string, encoding?: TextEncodingOptions): Uint8Array {
  const nativeUtf8 = encoding?.nativeUtf8 ?? DEFAULT_ENCODING.nativeUtf8;
  const codePages = encoding?.codePages ?? DEFAULT_ENCODING.codePages;
  return encodeTextForPrinter(text, { nativeUtf8, codePages }).bytes;
}
