import type { DitherAlgorithm } from '../../../image';
import type { Bitmap } from '../../../types';

/** Options cho 1 element ảnh raster. */
export interface ImageOptions {
  /** Toạ độ X, tính bằng dots. */
  x?: number;

  /** Toạ độ Y, tính bằng dots. */
  y?: number;

  /** Chiều rộng khi render, tính bằng dots — bỏ trống để dùng chiều rộng gốc của bitmap. */
  width?: number;

  /** Chiều cao khi render, tính bằng dots — bỏ trống để dùng chiều cao gốc của bitmap. */
  height?: number;

  /** Thuật toán dithering khi ảnh gốc chưa ở dạng 1-bit. */
  dither?: DitherAlgorithm;

  /** Ngưỡng đen/trắng (0-255, mặc định 128) — chỉ dùng khi `dither` là `'threshold'` hoặc bỏ trống. */
  threshold?: number;
}

/** Một ảnh raster, render từ `Bitmap` đã giải mã sẵn. */
export interface ImageElement {
  type: 'image';
  bitmap: Bitmap;
  options?: ImageOptions;
}
