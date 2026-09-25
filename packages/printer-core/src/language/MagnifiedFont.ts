/** Font cố định của máy in chỉ đổi cỡ bằng hệ số phóng đại nguyên (không chọn được font khác). */
export interface MagnifiedFont {
  /** Chiều cao chữ ở hệ số 1, dots. */
  readonly baseHeightDots: number;

  /** Hệ số phóng đại lớn nhất lệnh của ngôn ngữ nhận được. */
  readonly maxMagnification: number;
}

/** Hệ số phóng đại cho chiều cao gần `fontSizeDots` nhất; bỏ trống cỡ chữ thì dùng hệ số 1. */
export function chooseMagnification(fontSizeDots: number | undefined, font: MagnifiedFont): number {
  if (fontSizeDots === undefined) return 1;
  const magnification = Math.round(fontSizeDots / font.baseHeightDots);
  return Math.min(font.maxMagnification, Math.max(1, magnification));
}

/** Chiều cao chữ thật (dots) khi in ở `magnification`. */
export function magnifiedHeight(magnification: number, font: MagnifiedFont): number {
  return font.baseHeightDots * magnification;
}
