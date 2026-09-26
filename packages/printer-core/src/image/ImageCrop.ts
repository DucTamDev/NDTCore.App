import type { Rect } from '../types/Rect';

/** Cắt ảnh RGBA theo vùng `region`. */
export function cropRgba(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  region: Rect,
): Uint8Array {
  const rx = region.x ?? 0;
  const ry = region.y ?? 0;
  const rw = region.width ?? width - rx;
  const rh = region.height ?? height - ry;

  const out = new Uint8Array(rw * rh * 4);
  for (let row = 0; row < rh; row++) {
    const srcStart = ((ry + row) * width + rx) * 4;
    const destStart = row * rw * 4;
    out.set(rgba.subarray(srcStart, srcStart + rw * 4), destStart);
  }
  return out;
}
