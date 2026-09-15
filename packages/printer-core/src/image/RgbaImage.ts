/**
 * Reduces RGBA pixel data to a single-channel grayscale buffer. Since thermal
 * paper has no notion of transparency, translucent pixels are first flattened
 * onto an opaque white backdrop before the RGB channels are folded down to a
 * brightness value using the BT.601 luma weights.
 */
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
    // Blend each channel toward white (255) in proportion to how transparent the pixel is
    const rr = (r * a + 255 * (255 - a)) / 255;
    const gg = (g * a + 255 * (255 - a)) / 255;
    const bb = (b * a + 255 * (255 - a)) / 255;
    // BT.601 luma weights — green contributes the most to perceived brightness, blue the least
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
