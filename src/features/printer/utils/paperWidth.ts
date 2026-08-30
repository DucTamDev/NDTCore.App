import type { PaperSize } from '../types/printer.types';

/**
 * Số ký tự/dòng ước lượng theo khổ giấy, dùng font mặc định (Font A) của máy
 * in ESC/POS — 32 ký tự cho 58mm, 48 ký tự cho 80mm là quy ước phổ biến của
 * máy in nhiệt POS, không đọc được từ driver/SDK nên phải hardcode theo khổ
 * giấy thay vì đo thật.
 */
export const PAPER_WIDTH_CHARS: Record<PaperSize, number> = {
  58: 32,
  80: 48,
  100: 64,
  104: 69,
};

/**
 * Chiều rộng ảnh bill (px) theo khổ giấy — dùng khi render bill thành ảnh
 * cho TSPL (`useBillImageCapture`). 576px cho 80mm khớp quy ước đã dùng ở
 * bill web (`build-bill-canvas.util.ts`); 384px cho 58mm theo cùng tỷ lệ.
 */
export const PAPER_IMAGE_WIDTH_PX: Record<PaperSize, number> = {
  58: 384,
  80: 576,
  100: 768,
  104: 832,
};

export const formatRow = (left: string, right: string, width: number): string => {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(gap)}${right}`;
};
