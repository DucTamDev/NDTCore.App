import type { QrCodeConfig } from '../../../symbology/qrcode';

/**
 * Element QR code 2D — render qua lệnh gốc của máy in. Cấu hình nằm ở
 * `QrCodeConfig` (xem `../../../symbology/qrcode`).
 */
export interface QrCodeElement {
  type: 'qrcode';
  options: QrCodeConfig;
}
