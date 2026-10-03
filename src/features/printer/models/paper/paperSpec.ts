import type { PaperSize } from './PaperOptions';

/** 203 dpi ≈ 8 dot/mm — mật độ dot chuẩn của máy in nhiệt, dùng để đổi mm ↔ dot. */
export const DOTS_PER_MM = 8;

/** Thông số in của một khổ giấy. */
interface PaperSizeSpec {
  /** Bề rộng vùng in được (mm), hẹp hơn khổ giấy vì lề của đầu in. */
  printableWidthMm: number;

  /** Số ký tự font chuẩn trên một dòng khi in lệnh văn bản. */
  charsPerLine: number;

  /** Bề rộng ảnh khi in ảnh (px, 1 px = 1 dot). */
  imageWidthPx: number;
}

/**
 * Máy in không báo được thông số này nên lấy theo quy ước POS phổ biến; thêm khổ mới là thêm một dòng.
 * Số của khổ 100/104 chưa kiểm trên máy thật.
 */
export const PAPER_SIZE_SPECS: Record<PaperSize, PaperSizeSpec> = {
  58: { printableWidthMm: 50, charsPerLine: 32, imageWidthPx: 384 },
  80: { printableWidthMm: 72, charsPerLine: 48, imageWidthPx: 576 },
  100: { printableWidthMm: 96, charsPerLine: 64, imageWidthPx: 768 },
  104: { printableWidthMm: 104, charsPerLine: 69, imageWidthPx: 832 },
};

/**
 * Trần chiều cao (mm) của nội dung in ảnh trên giấy cuộn: không phải giới hạn phần cứng, chỉ chặn một document lỗi
 * sinh ra ảnh khổng lồ.
 */
export const CONTINUOUS_HEIGHT_MM = 200;
