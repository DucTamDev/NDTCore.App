import type { PrinterLanguage } from '../core';
import { LANGUAGE_REGISTRY } from './LanguageRegistry';

/** Ngôn ngữ printer-core hỗ trợ; lấy từ key của registry để không bao giờ lệch với những gì đã đăng ký. */
export const SUPPORTED_LANGUAGES: readonly PrinterLanguage[] = Object.keys(LANGUAGE_REGISTRY) as PrinterLanguage[];
