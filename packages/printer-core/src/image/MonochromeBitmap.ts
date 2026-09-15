export type { Bitmap as MonochromeBitmap } from '../types/Bitmap';
import type { Bitmap } from '../types/Bitmap';

/** Pack 8-bit dithered pixels (0 or 255) into a 1-bit MonochromeBitmap, row-major, MSB-first. */
export function packBitmap(dithered: Uint8Array, width: number, height: number): Bitmap {
  const bytesPerRow = Math.ceil(width / 8);
  const data = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBlack = dithered[y * width + x] === 0;
      if (isBlack) {
        const byteIdx = y * bytesPerRow + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        // eslint-disable-next-line no-bitwise -- intentional bit packing, MSB-first per pixel row
        data[byteIdx]! |= 1 << bitIdx;
      }
    }
  }

  return { data, width, height, bytesPerRow };
}
