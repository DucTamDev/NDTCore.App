import type { QrCodeConfig } from '../../symbology/qrcode';

/**
 * QR code element — renders a 2D QR code via the printer's native command.
 * Configuration lives in `QrCodeConfig` (see `../../symbology/qrcode`).
 */
export interface QrCodeElement {
  type: 'qrcode';
  options: QrCodeConfig;
}
