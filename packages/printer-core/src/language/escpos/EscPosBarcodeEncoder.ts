import type { BarcodeConfig, BarcodeSymbology } from '../../symbology/barcode';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';

/**
 * Mã chọn symbology cho "GS k" format B (m >= 65), theo tài liệu Epson
 * ESC/POS Application Programming Guide. Dùng thống nhất format B (dữ liệu
 * có tiền tố độ dài) thay vì format A (dữ liệu kết thúc bằng NUL) vì đây là
 * format duy nhất trong hai loại hỗ trợ cả CODE93/CODE128.
 *
 * Không có source nào của portakal port phần này: portakal chưa từng compile
 * barcode element. Bảng ánh xạ này, cùng cấu trúc byte "GS k" bên dưới, được
 * suy ra từ chiều decode trong parsers/escpos.ts của portakal (phần xử lý GS
 * k) làm chuẩn tham chiếu cho hình dạng một lệnh format-B đúng spec.
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

/**
 * Encode một `BarcodeConfig` thành chuỗi byte ESC/POS: các lệnh thiết lập
 * width/height/HRI tuỳ chọn, theo sau bởi lệnh barcode "GS k" format B.
 * ESC/POS không có định vị x/y tuyệt đối nên `config.x`/`config.y` không thể
 * encode và bị bỏ qua (cùng giới hạn như mô hình text/receipt).
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
