import type { DitherAlgorithm } from './dithering/DitherAlgorithm';
import { ditherThreshold } from './dithering/ThresholdDither';
import { ditherFloydSteinberg } from './dithering/FloydSteinbergDither';
import { ditherAtkinson } from './dithering/AtkinsonDither';
import { ditherOrdered } from './dithering/OrderedDither';

/** Dispatch to the dithering algorithm named by `algorithm`, producing 8-bit output (0 or 255 per pixel). */
export function applyDither(
  gray: Uint8Array,
  width: number,
  height: number,
  algorithm: DitherAlgorithm,
  threshold?: number,
): Uint8Array {
  switch (algorithm) {
    case 'floyd-steinberg':
      return ditherFloydSteinberg(gray, width, height);
    case 'atkinson':
      return ditherAtkinson(gray, width, height);
    case 'ordered':
      return ditherOrdered(gray, width, height);
    default:
      return ditherThreshold(gray, width, height, threshold ?? 128);
  }
}
