/** Convert RGBA pixel data to grayscale (BT.601 luminance, alpha composited on white). */
export function rgbaToGrayscale(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    const a = rgba[i * 4 + 3]!;
    // Composite alpha on white background
    const rr = (r * a + 255 * (255 - a)) / 255;
    const gg = (g * a + 255 * (255 - a)) / 255;
    const bb = (b * a + 255 * (255 - a)) / 255;
    // BT.601 luminance
    gray[i] = Math.round(0.299 * rr + 0.587 * gg + 0.114 * bb);
  }
  return gray;
}

/** Named alias for {@link rgbaToGrayscale}, matching this module's `RgbaImage` public API. */
export function toGrayscale(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  return rgbaToGrayscale(rgba, width, height);
}
