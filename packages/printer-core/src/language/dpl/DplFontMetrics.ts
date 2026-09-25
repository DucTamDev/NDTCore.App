import { chooseMagnification, magnifiedHeight, type MagnifiedFont } from '../MagnifiedFont';

/** Font `9` của DPL, phóng đại qua 2 trường chiều cao/rộng của bản ghi text (1-9). */
const DPL_FONT: MagnifiedFont = { baseHeightDots: 12, maxMagnification: 9 };

/** Quy đổi cỡ chữ (dots) ↔ hệ số phóng đại của bản ghi text DPL — nguồn font duy nhất của DPL. */
export const DplFontMetrics = {
  /** Hệ số phóng đại gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng hệ số 1. */
  fontSizeToMagnification(fontSizeDots: number | undefined): number {
    return chooseMagnification(fontSizeDots, DPL_FONT);
  },

  /** Chiều cao chữ thật (dots) ở 1 hệ số phóng đại. */
  magnificationToFontSize(magnification: number): number {
    return magnifiedHeight(magnification, DPL_FONT);
  },
};
