import type { Bitmap } from '../../types';
import { STAR_PRNT, concatStarPrntBytes } from './StarPrntCommand';

/**
 * Encode a monochrome bitmap as a Star Line Mode raster image: enter raster
 * mode, emit one "b nL nH data" record per row, exit raster mode. Direct
 * port of portakal's Star PRNT "image" case, the one part of that compiler
 * the mapping spec calls a correct, direct port — unlike ESC/POS's single
 * whole-image "GS v 0" header, Star raster mode is per-row.
 */
export function encodeStarPrntImage(bitmap: Bitmap): Uint8Array {
  const chunks: Uint8Array[] = [new Uint8Array([STAR_PRNT.ESC, ...STAR_PRNT.RASTER_ENTER])];

  for (let y = 0; y < bitmap.height; y++) {
    // eslint-disable-next-line no-bitwise -- splitting bytesPerRow into a little-endian byte pair, per Star Line Mode's "b nL nH data" wire format
    const nL = bitmap.bytesPerRow & 0xff;
    // eslint-disable-next-line no-bitwise -- see above
    const nH = (bitmap.bytesPerRow >> 8) & 0xff;
    const rowStart = y * bitmap.bytesPerRow;
    chunks.push(new Uint8Array([STAR_PRNT.RASTER_LINE, nL, nH]));
    chunks.push(bitmap.data.slice(rowStart, rowStart + bitmap.bytesPerRow));
  }

  chunks.push(new Uint8Array([STAR_PRNT.ESC, ...STAR_PRNT.RASTER_EXIT]));

  return concatStarPrntBytes(chunks);
}
