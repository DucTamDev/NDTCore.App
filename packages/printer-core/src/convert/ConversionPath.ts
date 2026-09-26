import type { PrinterLanguage } from '../core';
import { ConversionRegistry } from './ConversionRegistry';

/** 1 cặp chuyển đổi nguồn → đích. */
export interface ConversionPath {
  /** Ngôn ngữ của lệnh nguồn. */
  from: PrinterLanguage;

  /** Ngôn ngữ cần chuyển sang. */
  to: PrinterLanguage;
}

// Lấy từ chính key của registry để danh sách không bao giờ lệch với những gì registry hỗ trợ.
const REGISTERED_LANGUAGES = Object.keys(ConversionRegistry) as PrinterLanguage[];

/** Các ngôn ngữ dùng được làm nguồn chuyển đổi. */
export const SUPPORTED_SOURCES: PrinterLanguage[] = [...REGISTERED_LANGUAGES];

/** Các ngôn ngữ dùng được làm đích chuyển đổi. */
export const SUPPORTED_TARGETS: PrinterLanguage[] = [...REGISTERED_LANGUAGES];
