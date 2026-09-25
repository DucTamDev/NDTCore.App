import { chooseMagnification, magnifiedHeight, type MagnifiedFont } from '../MagnifiedFont';

/** Font 24 dots của Star Line Mode, phóng đại qua `ESC i h w` (1-6 lần mỗi chiều). */
const STAR_PRNT_FONT: MagnifiedFont = { baseHeightDots: 24, maxMagnification: 6 };

/** Quy đổi cỡ chữ (dots) ↔ hệ số phóng đại `ESC i h w` của Star PRNT — nguồn font duy nhất của Star PRNT. */
export const StarPrntFontMetrics = {
  /** Hệ số phóng đại gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng hệ số 1. */
  fontSizeToMagnification(fontSizeDots: number | undefined): number {
    return chooseMagnification(fontSizeDots, STAR_PRNT_FONT);
  },

  /** Chiều cao chữ thật (dots) ở 1 hệ số phóng đại. */
  magnificationToFontSize(magnification: number): number {
    return magnifiedHeight(magnification, STAR_PRNT_FONT);
  },
};
