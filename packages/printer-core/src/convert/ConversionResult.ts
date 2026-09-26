import type { PrintElement } from '../document';

/** Kết quả chuyển lệnh máy in từ ngôn ngữ này sang ngôn ngữ khác (xem `convert()`). */
export interface ConversionResult {
  /**
   * Lệnh ở ngôn ngữ đích. TSPL trả nguyên chuỗi lệnh; ESC/POS (ra byte) trả chuỗi 1 ký tự = 1 byte (0-255), lấy
   * lại byte bằng `Uint8Array.from(output, (c) => c.charCodeAt(0))`.
   */
  output: string;

  /** Element dựng lại khi parse lệnh nguồn, trước khi compile sang ngôn ngữ đích. */
  elements: PrintElement[];

  /**
   * Cảnh báo khi parse source (VD lệnh không nhận diện được) và khi compile sang
   * ngôn ngữ đích (VD element không hỗ trợ).
   */
  warnings: string[];
}
