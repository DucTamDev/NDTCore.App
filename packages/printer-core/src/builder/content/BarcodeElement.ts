import type { BarcodeConfig } from '../../barcode';

/**
 * Barcode element — renders a 1D barcode via the printer's native barcode
 * command. Configuration lives in `BarcodeConfig` (see `../../barcode`).
 */
export interface BarcodeElement {
  type: 'barcode';
  options: BarcodeConfig;
}
