/** 4x4 Bayer ordered dithering matrix. */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Ordered dithering using a 4x4 Bayer matrix. */
export function ditherOrdered(gray: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(gray.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const threshold = (BAYER4[y % 4]![x % 4]! / 16) * 255;
      out[y * width + x] = gray[y * width + x]! > threshold ? 255 : 0;
    }
  }
  return out;
}
