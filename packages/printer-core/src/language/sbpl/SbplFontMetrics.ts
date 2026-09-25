import { chooseMagnification, magnifiedHeight, type MagnifiedFont } from '../MagnifiedFont';

/** Font mặc định của SBPL, phóng đại qua trường `L` (2 chữ số mỗi chiều, 1-12). */
const SBPL_FONT: MagnifiedFont = { baseHeightDots: 12, maxMagnification: 12 };

/** Quy đổi cỡ chữ (dots) ↔ hệ số phóng đại trường `L` của SBPL — nguồn font duy nhất của SBPL. */
export const SbplFontMetrics = {
  /** Hệ số phóng đại gần cỡ chữ nhất; bỏ trống cỡ chữ thì dùng hệ số 1. */
  fontSizeToMagnification(fontSizeDots: number | undefined): number {
    return chooseMagnification(fontSizeDots, SBPL_FONT);
  },

  /** Chiều cao chữ thật (dots) ở 1 hệ số phóng đại. */
  magnificationToFontSize(magnification: number): number {
    return magnifiedHeight(magnification, SBPL_FONT);
  },
};
