/** Font native + kích thước dots cho lệnh `^A` ZPL. */
export interface ZplNativeFont {
  /** Mã font ZPL; luôn `0` (CG Triumvirate, co giãn được). */
  readonly font: string;

  /** Chiều cao chữ, dots — tham số `h` của `^A`. */
  readonly heightDots: number;

  /** Độ rộng chữ, dots — tham số `w` của `^A`. */
  readonly widthDots: number;
}

/** Font `0` co giãn tới đúng chiều cao dots được yêu cầu, nên không cần chọn font bitmap. */
const ZPL_SCALABLE_FONT = '0';

/** Chiều cao `^A` khi element không khai báo cỡ chữ. */
const DEFAULT_FONT_HEIGHT_DOTS = 30;

/** ZPL không nhận chiều cao 0 cho `^A`. */
const MIN_FONT_HEIGHT_DOTS = 1;

/** Quy đổi cỡ chữ (dots) ↔ tham số `^A` ZPL — nguồn font duy nhất của ZPL. */
export const ZplFontMetrics = {
  /** Font `0` với chiều cao = rộng = cỡ chữ (làm tròn dots); bỏ trống cỡ chữ thì dùng 30 dots. */
  fontSizeToNative(fontSizeDots: number | undefined): ZplNativeFont {
    const heightDots = Math.max(MIN_FONT_HEIGHT_DOTS, Math.round(fontSizeDots ?? DEFAULT_FONT_HEIGHT_DOTS));
    return { font: ZPL_SCALABLE_FONT, heightDots, widthDots: heightDots };
  },

  /** Cỡ chữ (dots) từ tham số chiều cao của `^A`/`^CF` — mọi font ZPL đều co giãn theo tham số này. */
  nativeToFontSize(heightDots: number): number {
    return heightDots;
  },
};
