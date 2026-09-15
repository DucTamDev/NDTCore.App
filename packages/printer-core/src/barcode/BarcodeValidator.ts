import type { BarcodeConfig } from './BarcodeConfig';

/**
 * A validation finding for a barcode (or QR code) config.
 *
 * Minimal local shape for Phase 1 — the shared `validation/` folder with
 * a language-specific `ValidationIssue` type doesn't exist until Task 8/9.
 */
export interface BarcodeValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

const EAN13_LENGTHS = [12, 13];
const EAN8_LENGTHS = [7, 8];

/**
 * Validates a `BarcodeConfig` against printer-native constraints, without
 * computing or rendering any actual bars.
 */
export function validateBarcodeConfig(config: BarcodeConfig): BarcodeValidationIssue[] {
  const issues: BarcodeValidationIssue[] = [];

  if (config.content.length === 0) {
    issues.push({ level: 'error', message: 'Barcode content must not be empty.' });
  }

  if (config.height !== undefined && config.height <= 0) {
    issues.push({ level: 'error', message: 'Barcode height must be positive.' });
  }

  if (config.narrowBarWidth !== undefined && config.narrowBarWidth <= 0) {
    issues.push({ level: 'error', message: 'Narrow bar width must be positive.' });
  }

  if (config.wideBarWidth !== undefined && config.wideBarWidth <= 0) {
    issues.push({ level: 'error', message: 'Wide bar width must be positive.' });
  }

  if (config.symbology === 'ean13' && !EAN13_LENGTHS.includes(config.content.length)) {
    issues.push({ level: 'error', message: 'EAN-13 content must be 12 or 13 digits.' });
  }

  if (config.symbology === 'ean8' && !EAN8_LENGTHS.includes(config.content.length)) {
    issues.push({ level: 'error', message: 'EAN-8 content must be 7 or 8 digits.' });
  }

  return issues;
}
