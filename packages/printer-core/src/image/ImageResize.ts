/** Resize an RGBA image using nearest-neighbor sampling. */
export function resizeNearestNeighbor(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
): Uint8Array {
  const out = new Uint8Array(targetWidth * targetHeight * 4);
  const xRatio = width / targetWidth;
  const yRatio = height / targetHeight;

  for (let ty = 0; ty < targetHeight; ty++) {
    const sy = Math.min(height - 1, Math.floor(ty * yRatio));
    for (let tx = 0; tx < targetWidth; tx++) {
      const sx = Math.min(width - 1, Math.floor(tx * xRatio));
      const srcIdx = (sy * width + sx) * 4;
      const destIdx = (ty * targetWidth + tx) * 4;
      out[destIdx] = rgba[srcIdx]!;
      out[destIdx + 1] = rgba[srcIdx + 1]!;
      out[destIdx + 2] = rgba[srcIdx + 2]!;
      out[destIdx + 3] = rgba[srcIdx + 3]!;
    }
  }
  return out;
}
