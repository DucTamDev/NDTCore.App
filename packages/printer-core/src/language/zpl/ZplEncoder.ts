import type { Bitmap } from '../../types';

/**
 * Encode a monochrome bitmap as the ASCII-hex payload the ZPL `^GFA` command
 * expects: every packed byte of `bitmap.data` (MSB-first, bit 1 = black,
 * same convention `Bitmap` uses everywhere else in this package) rendered as
 * two uppercase hex digits, back to back with no separators — `^GFA`'s own
 * `a` parameter (ASCII-hex compression) is what tells the printer to decode
 * the following text back into binary this way, per the Zebra ZPL II
 * Programming Guide's Graphic Field command.
 *
 * Direct, unmodified port of portakal's `languages/zpl.ts` image-case hex
 * loop — the plan flags this one as already correct, no bug fix needed here
 * unlike EPL/DPL/IPL's `^GFA`-equivalents in later tasks.
 */
export function encodeZplBitmapPayload(bitmap: Bitmap): string {
  let hex = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    hex += bitmap.data[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}
