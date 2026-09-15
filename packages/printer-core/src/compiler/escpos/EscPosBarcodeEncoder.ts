import type { BarcodeConfig, BarcodeSymbology } from '../../barcode';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';

/**
 * "GS k" format-B symbology selector codes (m >= 65), per the Epson ESC/POS
 * Application Programming Guide. Format B (length-prefixed) is used
 * uniformly here — rather than format A's NUL-terminated data — because
 * it's the only one of the two that covers CODE93/CODE128 as well.
 *
 * No portakal source ports this: portakal never compiles barcode elements.
 * This mapping, and the wrapping "GS k" byte layout below, is derived from
 * the decode side in portakal's parsers/escpos.ts (GS k handling) as the
 * ground truth for what a spec-conformant format-B command looks like.
 */
const SYMBOLOGY_CODE: Record<BarcodeSymbology, number> = {
  upca: 65,
  upce: 66,
  ean13: 67,
  ean8: 68,
  code39: 69,
  itf: 70,
  codabar: 71,
  code93: 72,
  code128: 73,
};

/** HRI (human-readable interpretation) text printed below the bars. */
const HRI_BELOW_BARS = 2;

/**
 * Encode a `BarcodeConfig` as an ESC/POS byte sequence: optional width/
 * height/HRI setup commands followed by a "GS k" format-B barcode command.
 * ESC/POS has no absolute x/y positioning, so `config.x`/`config.y` are
 * not encodable and are ignored (same limitation as the text/receipt model).
 */
export function encodeEscPosBarcode(config: BarcodeConfig): Uint8Array {
  const chunks: Uint8Array[] = [];

  if (config.narrowBarWidth !== undefined) {
    chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.BARCODE_WIDTH, config.narrowBarWidth]));
  }
  if (config.height !== undefined) {
    chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.BARCODE_HEIGHT, config.height]));
  }
  if (config.readable) {
    chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.HRI_POSITION, HRI_BELOW_BARS]));
  }

  const data = new TextEncoder().encode(config.content);
  const m = SYMBOLOGY_CODE[config.symbology];
  chunks.push(new Uint8Array([ESC_POS.GS, ESC_POS.BARCODE, m, data.length, ...data]));

  return concatEscPosBytes(chunks);
}
