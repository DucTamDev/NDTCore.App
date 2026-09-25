/** Kích thước dots cho clause `h`/`w` của field text `H` IPL. */
export interface IplNativeFont {
  /** Chiều cao chữ, dots — clause `h`. */
  readonly heightDots: number;

  /** Độ rộng chữ, dots — clause `w`. */
  readonly widthDots: number;
}

/** Chiều cao chữ khi element không khai báo cỡ chữ. */
const DEFAULT_FONT_HEIGHT_DOTS = 12;

/** IPL không nhận chiều cao 0. */
const MIN_FONT_HEIGHT_DOTS = 1;

/**
 * Quy đổi cỡ chữ (dots) ↔ clause `h`/`w` của IPL — nguồn font duy nhất của IPL. Font/charset của IPL cố định,
 * cỡ chữ đi thẳng vào clause tính bằng dots nên không cần chọn font.
 */
export const IplFontMetrics = {
  /** Chiều cao = rộng = cỡ chữ (làm tròn dots); bỏ trống cỡ chữ thì dùng 12 dots. */
  fontSizeToNative(fontSizeDots: number | undefined): IplNativeFont {
    const heightDots = Math.max(MIN_FONT_HEIGHT_DOTS, Math.round(fontSizeDots ?? DEFAULT_FONT_HEIGHT_DOTS));
    return { heightDots, widthDots: heightDots };
  },

  /** Cỡ chữ (dots) từ clause `h` đọc được. */
  nativeToFontSize(heightDots: number): number {
    return heightDots;
  },
};
