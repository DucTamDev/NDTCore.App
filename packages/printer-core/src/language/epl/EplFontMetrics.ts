import {
  bitmapFontHeight,
  bitmapFontSize,
  chooseBitmapFont,
  type BitmapFontChoice,
  type BitmapFontSet,
  type BitmapFontSize,
} from '../BitmapFont';

/** Hệ số nhân ngang của lệnh `A` EPL2 chỉ nhận 1-6 (dọc nhận tới 9) — dùng chung 1 hệ số cho cả 2 chiều. */
const EPL_MAX_MAGNIFICATION = 6;

/** Font bitmap có sẵn của EPL2, theo EPL2 Programmer's Guide. */
const EPL_FONT_SET: BitmapFontSet = {
  fonts: {
    '1': { width: 8, height: 12 },
    '2': { width: 10, height: 16 },
    '3': { width: 12, height: 20 },
    '4': { width: 14, height: 24 },
    '5': { width: 32, height: 48 },
  },
  // Font 5 chỉ có chữ hoa nên không tự chọn cho nội dung bất kỳ.
  selectable: ['1', '2', '3', '4'],
  defaultFont: '2',
  maxMagnification: EPL_MAX_MAGNIFICATION,
};

/** Quy đổi cỡ chữ (dots) ↔ font + hệ số nhân của lệnh `A` EPL2 — nguồn font duy nhất của EPL. */
export const EplFontMetrics = {
  /** Font + hệ số nhân gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng font `2` ở hệ số 1. */
  fontSizeToNative(fontSizeDots: number | undefined): BitmapFontChoice {
    return chooseBitmapFont(fontSizeDots, EPL_FONT_SET);
  },

  /** Chiều cao chữ thật (dots) của 1 cặp font + hệ số nhân dọc đọc từ lệnh `A`. */
  nativeToFontSize(font: string, magnification: number): number {
    return bitmapFontHeight(font, magnification, EPL_FONT_SET);
  },

  /** Kích thước 1 ký tự ở hệ số 1 của `font` — preview dùng để tính độ rộng chữ. */
  characterSize(font: string): BitmapFontSize {
    return bitmapFontSize(font, EPL_FONT_SET);
  },
};
