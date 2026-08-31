import type { PaperSize } from '../types/printer.types';

/** 203 dpi ≈ 8 dot/mm — mật độ dot chuẩn của máy in nhiệt. Dùng để đổi mm ↔ dot. */
export const DOTS_PER_MM = 8;

interface PaperSizeSpec {
  printableWidthMm: number;
  charsPerLine: number;
  imageWidthPx: number;
}

/**
 * Thông số cứng theo khổ giấy — không đọc được từ máy in nên hardcode theo quy
 * ước POS phổ biến. Thêm khổ mới = thêm 1 dòng. Số cho 100/104 là tạm, chưa
 * verify trên phần cứng (spec 2026-08-30).
 */
export const PAPER_SIZE_SPECS: Record<PaperSize, PaperSizeSpec> = {
  58: { printableWidthMm: 50, charsPerLine: 32, imageWidthPx: 384 },
  80: { printableWidthMm: 72, charsPerLine: 48, imageWidthPx: 576 },
  100: { printableWidthMm: 96, charsPerLine: 64, imageWidthPx: 768 },
  104: { printableWidthMm: 104, charsPerLine: 69, imageWidthPx: 832 },
};
