import type { Unit, Direction } from '../types';

/** Khổ giấy và thiết lập in của 1 document, trước khi đổi sang dots. */
export interface PrintDocument {
  /** Chiều rộng giấy, tính theo `unit`. */
  width: number;

  /** Chiều dài nhãn, tính theo `unit`; bỏ trống khi giấy cuộn không cố định chiều dài. */
  height?: number;

  /** Đơn vị của `width`, `height`, `gap`. */
  unit?: Unit;

  /** Độ phân giải máy in (dots per inch). */
  dpi?: number;

  /** Khe hở giữa 2 nhãn liên tiếp, tính theo `unit`. */
  gap?: number;

  /** Tốc độ in, theo thang của máy in. */
  speed?: number;

  /** Độ đậm khi in, theo thang của máy in. */
  density?: number;

  /** Chiều đẩy nhãn ra khi in. */
  direction?: Direction;

  /** Số bản in. */
  copies?: number;
}
