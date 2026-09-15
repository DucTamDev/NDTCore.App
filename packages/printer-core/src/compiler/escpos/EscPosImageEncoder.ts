import type { Bitmap } from '../../types';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';

/**
 * Encode a monochrome bitmap as an ESC/POS raster bit image ("GS v 0").
 * Wrapped in a line-spacing override (n=0 before, default after) so image
 * rows print back-to-back instead of with the printer's normal text
 * line spacing between them — same wrapping as portakal's "image" case.
 */
export function encodeEscPosImage(bitmap: Bitmap): Uint8Array {
  // eslint-disable-next-line no-bitwise -- splitting dimensions into little-endian byte pairs, per GS v 0's wire format
  const xL = bitmap.bytesPerRow & 0xff;
  // eslint-disable-next-line no-bitwise -- see above
  const xH = (bitmap.bytesPerRow >> 8) & 0xff;
  // eslint-disable-next-line no-bitwise -- see above
  const yL = bitmap.height & 0xff;
  // eslint-disable-next-line no-bitwise -- see above
  const yH = (bitmap.height >> 8) & 0xff;

  const header = new Uint8Array([
    ESC_POS.ESC,
    ESC_POS.LINE_SPACING_SET,
    0,
    ESC_POS.GS,
    ESC_POS.RASTER_IMAGE[0],
    ESC_POS.RASTER_IMAGE[1],
    0,
    xL,
    xH,
    yL,
    yH,
  ]);
  const footer = new Uint8Array([ESC_POS.ESC, ESC_POS.LINE_SPACING_DEFAULT]);

  return concatEscPosBytes([header, bitmap.data, footer]);
}
