import type { BarcodeConfig, BarcodeSymbology } from '../../symbology/barcode';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';

/**
 * Mã symbology cho lệnh "GS k" format B (m >= 65). Dùng thống nhất format B
 * (dữ liệu có tiền tố độ dài) thay vì format A (kết thúc bằng NUL) vì đây là
 * format duy nhất hỗ trợ cả CODE93 và CODE128.
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

/** In text HRI (human-readable interpretation) bên dưới các vạch mã. */
const HRI_BELOW_BARS = 2;

/** ESC/POS không có lệnh định vị x/y tuyệt đối nên `config.x`/`config.y` bị bỏ qua. */
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
