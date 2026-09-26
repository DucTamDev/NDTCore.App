import type { DitherAlgorithm } from './dithering/DitherAlgorithm';
import type { MonochromeBitmap } from './MonochromeBitmap';
import { packBitmap } from './MonochromeBitmap';
import { rgbaToGrayscale } from './RgbaImage';
import { applyDither } from './ImageDither';

/** Đổi ảnh RGBA thành {@link MonochromeBitmap} bằng thuật toán dither đã chọn. */
export function imageToMonochrome(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: { dither?: DitherAlgorithm; threshold?: number } = {},
): MonochromeBitmap {
  const gray = rgbaToGrayscale(rgba, width, height);
  const algorithm = options.dither ?? 'threshold';
  const dithered = applyDither(gray, width, height, algorithm, options.threshold);
  return packBitmap(dithered, width, height);
}
