import { chooseMagnification, magnifiedHeight, type MagnifiedFont } from '../MagnifiedFont';

/** Font A 12×24 của ESC/POS, phóng đại qua 1 nibble của `GS ! n` (1-8 lần mỗi chiều). */
const ESC_POS_FONT: MagnifiedFont = { baseHeightDots: 24, maxMagnification: 8 };

/** Quy đổi cỡ chữ (dots) ↔ hệ số phóng đại `GS ! n` của ESC/POS — nguồn font duy nhất của ESC/POS. */
export const EscPosFontMetrics = {
  /** Hệ số phóng đại gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng hệ số 1. */
  fontSizeToMagnification(fontSizeDots: number | undefined): number {
    return chooseMagnification(fontSizeDots, ESC_POS_FONT);
  },

  /** Chiều cao chữ thật (dots) ở 1 hệ số phóng đại. */
  magnificationToFontSize(magnification: number): number {
    return magnifiedHeight(magnification, ESC_POS_FONT);
  },
};
