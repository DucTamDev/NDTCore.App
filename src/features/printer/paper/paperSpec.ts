import type { PaperSize } from '../models/paper/PrintPaperConfig';

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

/**
 * Ngưỡng an toàn chiều cao (mm) cho nội dung render bitmap trên giấy cuộn
 * liên tục (continuous) — không phải giới hạn phần cứng thật, chỉ để chặn 1
 * document lỗi/vô hạn vòng lặp tạo ra bitmap khổng lồ. Dùng chung cho mọi
 * protocol in trên giấy cuộn liên tục (ESC/POS luôn continuous; TSPL
 * continuous Receipt).
 */
export const CONTINUOUS_HEIGHT_MM = 200;
