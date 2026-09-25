import {
  bitmapFontHeight,
  bitmapFontSize,
  chooseBitmapFont,
  type BitmapFontChoice,
  type BitmapFontSet,
  type BitmapFontSize,
} from '../BitmapFont';

/** Hệ số nhân của lệnh TEXT/BLOCK TSPL nhận giá trị 1-10. */
const TSPL_MAX_MAGNIFICATION = 10;

/** Font bitmap có sẵn của TSPL, theo TSPL/TSPL2 Programming Manual. */
const TSPL_FONT_SET: BitmapFontSet = {
  fonts: {
    '1': { width: 8, height: 12 },
    '2': { width: 12, height: 20 },
    '3': { width: 16, height: 24 },
    '4': { width: 24, height: 32 },
    '5': { width: 32, height: 48 },
    '6': { width: 14, height: 19 },
    '7': { width: 21, height: 27 },
    '8': { width: 14, height: 25 },
  },
  // Font 6-8 là OCR-B/OCR-A, không dùng cho chữ thường nên không tự chọn.
  selectable: ['1', '2', '3', '4', '5'],
  defaultFont: '2',
  maxMagnification: TSPL_MAX_MAGNIFICATION,
};

/** Quy đổi cỡ chữ (dots) ↔ font + hệ số nhân của lệnh TEXT/BLOCK TSPL — nguồn font duy nhất của TSPL. */
export const TsplFontMetrics = {
  /** Font + hệ số nhân gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng font `2` ở hệ số 1. */
  fontSizeToNative(fontSizeDots: number | undefined): BitmapFontChoice {
    return chooseBitmapFont(fontSizeDots, TSPL_FONT_SET);
  },

  /** Chiều cao chữ thật (dots) của 1 cặp font + hệ số nhân đọc từ lệnh TSPL. */
  nativeToFontSize(font: string, magnification: number): number {
    return bitmapFontHeight(font, magnification, TSPL_FONT_SET);
  },

  /** Kích thước 1 ký tự ở hệ số 1 của `font` — preview dùng để tính độ rộng chữ. */
  characterSize(font: string): BitmapFontSize {
    return bitmapFontSize(font, TSPL_FONT_SET);
  },
};
