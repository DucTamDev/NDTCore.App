import type { Bitmap } from '../../types';

/**
 * Encode a monochrome bitmap as the ASCII-hex payload the CPCL `EG`
 * (Expanded Graphics) command expects: every packed byte of `bitmap.data`
 * (MSB-first, bit 1 = black — CPCL's `EG` polarity matches `Bitmap`'s own
 * standard convention directly, no inversion needed, unlike EPL2's `GW`)
 * rendered as two uppercase hex digits, back to back with no separators —
 * the same ASCII-hex shape ZPL's `^GFA` uses, per the CPCL Programmer's
 * Manual's Expanded Graphics command.
 *
 * Direct, unmodified port of portakal's `languages/cpcl.ts` image-case hex
 * loop — the plan flags this one as already correct, no bug fix needed here
 * unlike EPL2/TSPL's bitmap commands.
 */
export function encodeCpclBitmapPayload(bitmap: Bitmap): string {
  let hex = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    hex += bitmap.data[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}
