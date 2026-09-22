/**
 * QR error correction level, as accepted by TSPL's `QRCODE` command's
 * `ecc` field ("L" | "M" | "Q" | "H", per the QR spec's own ECC letters).
 */
export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
