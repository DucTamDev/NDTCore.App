import type { QrCodeConfig, QrErrorCorrectionLevel } from '../../symbology/qrcode';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';

/**
 * Các byte sub-function "GS ( k" cho QR code, thuộc họ lệnh 2D-symbol trong
 * tài liệu Epson ESC/POS Application Programming Guide (cn = 0x31 cho mọi
 * hàm QR). Không có source nào của portakal port phần này: portakal chưa
 * từng compile QR element. Được suy ra từ chiều decode trong
 * parsers/escpos.ts của portakal (wrapper "GS ( k" tổng quát: GS, (, k, pL,
 * pH, <payload>) làm chuẩn tham chiếu cho cấu trúc byte bên ngoài mà mỗi
 * sub-command phải tạo ra.
 */
const QR_CN = 0x31;
const QR_FN_SELECT_MODEL = 0x41;
const QR_FN_SET_MODULE_SIZE = 0x43;
const QR_FN_SELECT_ERROR_CORRECTION = 0x45;
const QR_FN_STORE_DATA = 0x50;
const QR_FN_PRINT = 0x52;

const QR_MODEL_2 = 50; // "model 2" theo spec: 48 + số hiệu model
const QR_STORE_MODE = 48; // tham số "m" cố định trên các sub-command store/print

const ERROR_CORRECTION_CODE: Record<QrErrorCorrectionLevel, number> = {
  L: 48,
  M: 49,
  Q: 50,
  H: 51,
};

const MIN_MODULE_SIZE = 1;
const MAX_MODULE_SIZE = 16;
const DEFAULT_MODULE_SIZE = 3;

function gsParenK(payload: number[]): Uint8Array {
  const len = payload.length;
  // Tách độ dài payload thành cặp byte little-endian, theo wire format của GS ( k.
  // eslint-disable-next-line no-bitwise
  const lengthLow = len & 0xff;
  // eslint-disable-next-line no-bitwise
  const lengthHigh = (len >> 8) & 0xff;
  return new Uint8Array([ESC_POS.GS, ESC_POS.TWO_D_CODE[0], ESC_POS.TWO_D_CODE[1], lengthLow, lengthHigh, ...payload]);
}

function clampModuleSize(cellWidth: number | undefined): number {
  const size = cellWidth ?? DEFAULT_MODULE_SIZE;
  return Math.min(MAX_MODULE_SIZE, Math.max(MIN_MODULE_SIZE, Math.round(size)));
}

/**
 * Encode một `QrCodeConfig` thành chuỗi lệnh ESC/POS "GS ( k" chuẩn: chọn
 * model -> đặt kích thước module -> chọn mức sửa lỗi -> lưu dữ liệu -> in.
 * Máy in tự tính toán và render các module QR thật; chỉ nội dung và tham số
 * layout được gửi đi.
 */
export function encodeEscPosQrCode(config: QrCodeConfig): Uint8Array {
  const moduleSize = clampModuleSize(config.cellWidth);
  const errorCorrection = ERROR_CORRECTION_CODE[config.errorCorrection ?? 'M'];
  const data = Array.from(new TextEncoder().encode(config.content));

  return concatEscPosBytes([
    gsParenK([QR_CN, QR_FN_SELECT_MODEL, QR_MODEL_2, 0]),
    gsParenK([QR_CN, QR_FN_SET_MODULE_SIZE, moduleSize]),
    gsParenK([QR_CN, QR_FN_SELECT_ERROR_CORRECTION, errorCorrection]),
    gsParenK([QR_CN, QR_FN_STORE_DATA, QR_STORE_MODE, ...data]),
    gsParenK([QR_CN, QR_FN_PRINT, QR_STORE_MODE]),
  ]);
}
