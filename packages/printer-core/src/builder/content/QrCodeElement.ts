import type { QrCodeConfig } from '../../qrcode';

/**
 * QR code element — renders a 2D QR code via the printer's native command.
 * Configuration lives in `QrCodeConfig` (see `../../qrcode`).
 */
export interface QrCodeElement {
  type: 'qrcode';
  options: QrCodeConfig;
}
