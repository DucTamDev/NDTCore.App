/** Khổ giấy, tính bằng mm; có `heightMm` là tem (chiều cao cố định, phân trang), không có là giấy cuộn. */
export interface PaperSize {
  /** Chiều rộng vùng in, mm. */
  readonly widthMm: number;

  /** Chiều cao 1 tem, mm; bỏ trống là giấy cuộn. */
  readonly heightMm?: number;
}
