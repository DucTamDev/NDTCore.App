import type { PrinterProfile } from '../../profile';
import { encodeTextForPrinter } from '../../encoding';

/**
 * Fallback profile used when EscPosCompiler.compile() is called without a
 * PrinterProfile — CP437 is the ESC/POS factory-default code page on
 * virtually every Epson-compatible receipt printer.
 */
const DEFAULT_PROFILE = { features: { nativeUtf8: false, codePages: [437] } };

/**
 * Encode text for ESC/POS output via the printer profile's declared code page
 * (or raw UTF-8 when the profile is native-UTF8). Replaces portakal's
 * `ByteBuffer.writeText()`, which always wrote naive UTF-8 regardless of profile.
 */
export function encodeEscPosText(text: string, profile?: PrinterProfile): Uint8Array {
  return encodeTextForPrinter(text, profile ?? DEFAULT_PROFILE).bytes;
}
