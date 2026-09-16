import type { DitherAlgorithm } from '../../image';
import type { Bitmap } from '../../types';

/** Options for a raster image element. */
export interface ImageOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  dither?: DitherAlgorithm;
  threshold?: number;
}

/** A raster image, rendered from a pre-decoded `Bitmap`. */
export interface ImageElement {
  type: 'image';
  bitmap: Bitmap;
  options?: ImageOptions;
}
