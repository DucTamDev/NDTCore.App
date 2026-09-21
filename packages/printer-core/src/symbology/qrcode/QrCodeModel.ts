/**
 * Passthrough marker type for a QR code's payload.
 *
 * Kept minimal for Phase 1: portakal never computes an actual QR
 * bit-matrix itself (the printer firmware does), and no consumer here
 * needs a computed module grid yet — so this is just a content carrier,
 * not a Code128/QR bit-matrix generator.
 */
export interface QrCodeModel {
  content: string;
}
