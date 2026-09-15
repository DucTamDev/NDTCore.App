import type { BarcodeValidationIssue } from '../barcode/BarcodeValidator';
import type { QrCodeConfig } from './QrCodeConfig';

/** Practical ceiling for QR alphanumeric-mode payloads. */
const MAX_QR_CONTENT_LENGTH = 7089;

/**
 * Validates a `QrCodeConfig` against printer-native constraints, without
 * computing or rendering any actual QR modules.
 */
export function validateQrCodeConfig(config: QrCodeConfig): BarcodeValidationIssue[] {
  const issues: BarcodeValidationIssue[] = [];

  if (config.content.length === 0) {
    issues.push({ level: 'error', message: 'QR code content must not be empty.' });
  }

  if (config.content.length > MAX_QR_CONTENT_LENGTH) {
    issues.push({
      level: 'error',
      message: `QR code content must not exceed ${MAX_QR_CONTENT_LENGTH} characters.`,
    });
  }

  return issues;
}
