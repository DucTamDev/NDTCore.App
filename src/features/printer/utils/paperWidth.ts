import type { PaperSize } from '../types/printer.types';

/**
 * Số ký tự/dòng ước lượng theo khổ giấy, dùng font mặc định (Font A) của máy
 * in ESC/POS — 32 ký tự cho 58mm, 48 ký tự cho 80mm là quy ước phổ biến của
 * máy in nhiệt POS, không đọc được từ driver/SDK nên phải hardcode theo khổ
 * giấy thay vì đo thật.
 */
export const PAPER_WIDTH_CHARS: Record<PaperSize, number> = {
  '58mm': 32,
  '80mm': 48,
};

/**
 * Chiều rộng ảnh bill (px) theo khổ giấy — dùng khi render bill thành ảnh
 * cho TSPL (`useBillImageCapture`). 576px cho 80mm khớp quy ước đã dùng ở
 * bill web (`build-bill-canvas.util.ts`); 384px cho 58mm theo cùng tỷ lệ
 * (khổ in thật hẹp hơn khổ giấy danh nghĩa, đây là quy ước phổ biến của phần
 * mềm POS, không đo được từ driver).
 */
export const PAPER_IMAGE_WIDTH_PX: Record<PaperSize, number> = {
  '58mm': 384,
  '80mm': 576,
};

/**
 * Ghép `left`/`right` thành 1 dòng canh trái/phải trong `width` ký tự (vd
 * "Mã đơn" .... "#001"). Luôn chừa tối thiểu 1 khoảng trắng giữa 2 vế — nếu
 * `left`+`right` đã dài hơn `width`, chấp nhận dòng tự tràn qua dòng tiếp
 * theo trên máy in thay vì throw, khớp cách `table` element xử lý overflow.
 */
export const formatRow = (left: string, right: string, width: number): string => {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(gap)}${right}`;
};
