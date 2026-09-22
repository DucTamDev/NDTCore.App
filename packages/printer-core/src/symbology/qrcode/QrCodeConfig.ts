import type { Rotation } from '../../types/Rotation';
import type { QrErrorCorrectionLevel } from './QrCodeErrorCorrection';

/**
 * Cấu hình mô tả cho 1 element QR code.
 *
 * Theo đúng mô hình pass-through của lệnh mã 2D gốc máy in (TSPL `QRCODE`):
 * chỉ mô tả nội dung và tham số layout — firmware máy in tự tính và render
 * các module QR. Vị trí chỉ có x/y, giống `BarcodeConfig`.
 */
export interface QrCodeConfig {
  /** Toạ độ X, tính bằng dots. */
  x?: number;
  /** Toạ độ Y, tính bằng dots. */
  y?: number;
  /** Dữ liệu mã hoá trong QR code. */
  content: string;
  /** Kích thước 1 module (cell) QR, tính bằng dots. */
  cellWidth?: number;
  /** Mức sửa lỗi. */
  errorCorrection?: QrErrorCorrectionLevel;
  /** Góc xoay của QR code. */
  rotation?: Rotation;
}
