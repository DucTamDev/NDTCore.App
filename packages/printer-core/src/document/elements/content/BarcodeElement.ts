import type { BarcodeConfig } from '../../../symbology/barcode';

/**
 * Element mã vạch 1D — render qua lệnh barcode gốc của máy in. Cấu hình nằm
 * ở `BarcodeConfig` (xem `../../../symbology/barcode`).
 */
export interface BarcodeElement {
  type: 'barcode';
  options: BarcodeConfig;
}
