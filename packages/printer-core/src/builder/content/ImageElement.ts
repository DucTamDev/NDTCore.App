import type { DitherAlgorithm } from '../../image';

/** Options for a raster image element. */
export interface ImageOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  dither?: DitherAlgorithm;
  threshold?: number;
}
