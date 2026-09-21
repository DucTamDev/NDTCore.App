import type { Bitmap } from '../../types';

/**
 * Encode a monochrome bitmap as the ASCII-hex payload SBPL's `<ESC>GM`
 * (Graphics) field expects: every packed byte of `bitmap.data` (MSB-first,
 * bit 1 = black — `Bitmap`'s own standard convention, no inversion needed)
 * rendered as two uppercase hex digits, back to back with no separators —
 * the same ASCII-hex shape CPCL's `EG` and ZPL's `^GFA` use.
 *
 * Direct, unmodified port of portakal's `languages/sbpl.ts` image-case hex
 * loop — the plan flags this one as already correct, no bug fix needed here
 * unlike EPL2's/TSC's/DPL's/IPL's bitmap commands.
 */
export function encodeSbplBitmapPayload(bitmap: Bitmap): string {
  let hex = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    hex += bitmap.data[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}
