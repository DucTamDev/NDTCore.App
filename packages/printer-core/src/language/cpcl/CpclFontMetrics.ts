import {
  bitmapFontHeight,
  bitmapFontSize,
  chooseBitmapFont,
  type BitmapFontChoice,
  type BitmapFontSet,
  type BitmapFontSize,
} from '../BitmapFont';

/**
 * Compiler chỉ chọn font theo cỡ chữ, không phóng đại: trường `size` của lệnh `TEXT` CPCL chọn biến thể cỡ
 * riêng của từng font (0 = cỡ gốc), không phải hệ số nhân dùng chung được cho mọi font.
 */
const CPCL_MAX_MAGNIFICATION = 1;

/** Font bitmap có sẵn của CPCL, theo Zebra CPCL Font Manual (ZQ210/ZQ220). */
const CPCL_FONT_SET: BitmapFontSet = {
  fonts: {
    '0': { width: 8, height: 9 },
    '1': { width: 16, height: 48 },
    '2': { width: 20, height: 12 },
    '4': { width: 25, height: 47 },
    '5': { width: 16, height: 24 },
    '6': { width: 28, height: 27 },
    '7': { width: 12, height: 24 },
  },
  selectable: ['0', '2', '5', '7', '6', '4', '1'],
  defaultFont: '2',
  maxMagnification: CPCL_MAX_MAGNIFICATION,
};

/** Quy đổi cỡ chữ (dots) ↔ font + trường `size` của lệnh `TEXT` CPCL — nguồn font duy nhất của CPCL. */
export const CpclFontMetrics = {
  /** Font có chiều cao gần cỡ chữ nhất (luôn ở cỡ gốc); bỏ trống cỡ chữ thì dùng font `2`. */
  fontSizeToNative(fontSizeDots: number | undefined): BitmapFontChoice {
    return chooseBitmapFont(fontSizeDots, CPCL_FONT_SET);
  },

  /**
   * Chiều cao chữ (dots) ước lượng từ font + trường `size` đọc được — best-effort: coi `size` như hệ số nhân,
   * `0` là cỡ gốc.
   */
  nativeToFontSize(font: string, size: number): number {
    return bitmapFontHeight(font, Math.max(1, size), CPCL_FONT_SET);
  },

  /** Kích thước 1 ký tự ở cỡ gốc của `font`. */
  characterSize(font: string): BitmapFontSize {
    return bitmapFontSize(font, CPCL_FONT_SET);
  },
};
