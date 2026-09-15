import type { Rotation } from '../types/Rotation';
import type { QrErrorCorrectionLevel } from './QrCodeErrorCorrection';

/**
 * Descriptive config for a QR code element.
 *
 * Matches the pass-through model of printer-native 2D barcode commands
 * (TSC `QRCODE`): only a content string and layout parameters are
 * described here — the printer firmware computes and renders the actual
 * QR modules. Position is x/y only, same as `BarcodeConfig`.
 */
export interface QrCodeConfig {
  /** X position in dots. */
  x?: number;
  /** Y position in dots. */
  y?: number;
  /** Data encoded in the QR code. */
  content: string;
  /** Width of one QR module (cell), in dots. */
  cellWidth?: number;
  /** Error correction level. */
  errorCorrection?: QrErrorCorrectionLevel;
  /** Rotation of the QR code element. */
  rotation?: Rotation;
}
