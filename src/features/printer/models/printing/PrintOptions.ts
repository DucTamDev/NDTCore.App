/** Tùy chọn của một lần in. */
export interface PrintOptions {
  /** Số bản cần in. */
  copies?: number;

  /** Có cắt giấy sau khi in hay không. */
  cut?: boolean;

  /** Có mở ngăn kéo tiền sau khi in hay không. */
  cashDrawer?: boolean;

  /** Đẩy thêm giấy (mm) sau khi in. */
  feedMm?: number;
}
