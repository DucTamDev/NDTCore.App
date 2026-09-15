/** Simple threshold dithering: pixels below `threshold` become black (0), others white (255). */
export function ditherThreshold(
  gray: Uint8Array,
  width: number,
  height: number,
  threshold = 128,
): Uint8Array {
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = gray[i]! < threshold ? 0 : 255;
  }
  return out;
}
