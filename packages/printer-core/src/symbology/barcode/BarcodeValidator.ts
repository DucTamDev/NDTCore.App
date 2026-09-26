import type { BarcodeConfig } from './BarcodeConfig';

/** 1 vấn đề tìm thấy khi kiểm tra cấu hình barcode hoặc QR code. */
export interface BarcodeValidationIssue {
  /** Mức độ: lỗi hoặc cảnh báo. */
  level: 'error' | 'warning';

  /** Mô tả vấn đề. */
  message: string;
}

const EAN13_LENGTHS = [12, 13];
const EAN8_LENGTHS = [7, 8];

/** Kiểm tra `BarcodeConfig` theo giới hạn của lệnh barcode máy in (không tự vẽ vạch). */
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
