import type { BarcodeConfig } from '../../../symbology/barcode';

/**
 * Barcode element — renders a 1D barcode via the printer's native barcode
 * command. Configuration lives in `BarcodeConfig` (see `../../symbology/barcode`).
 */
export interface BarcodeElement {
  type: 'barcode';
  options: BarcodeConfig;
}
