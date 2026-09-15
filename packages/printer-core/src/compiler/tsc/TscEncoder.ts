import type { Bitmap } from '../../types';

/**
 * Encode a monochrome bitmap as the payload the TSPL2 `BITMAP` command
 * expects immediately after its trailing comma: exactly
 * `bitmap.bytesPerRow * bitmap.height` raw binary bytes (MSB-first, bit 1 =
 * black), with no length prefix or hex-ASCII re-encoding — the header's own
 * `bytesPerRow`/`height` fields already tell the printer how many bytes to
 * read next (this repo's own `src/features/printer/drivers/tspl/TsplEncoder.ts`
 * `image()` confirms the same raw-binary framing on real TSPL hardware).
 *
 * portakal's `compileToTSC()` builds the whole document as one `string`, so
 * `TscCompiler` follows suit rather than switching to bytes for this one
 * command — each payload byte is carried as a single raw char code (0-255),
 * the same "one string char per byte" convention `EscPosValidator` already
 * relies on to walk a string source as a byte stream.
 */
export function encodeTscBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    payload += String.fromCharCode(bitmap.data[i]);
  }
  return payload;
}
