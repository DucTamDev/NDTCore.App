import type { BarcodeValidationIssue } from '../barcode/BarcodeValidator';
import type { QrCodeConfig } from './QrCodeConfig';

/** Độ dài tối đa dùng được trong thực tế của nội dung QR dạng chữ số + chữ. */
const MAX_QR_CONTENT_LENGTH = 7089;

/** Kiểm tra `QrCodeConfig` theo giới hạn của lệnh QR máy in (không tự tính module). */
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
