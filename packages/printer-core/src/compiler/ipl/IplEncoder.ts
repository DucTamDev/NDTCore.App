import type { Bitmap } from '../../types';

/**
 * Encodes a monochrome bitmap as the raw payload appended after IPL's
 * Graphic (`G`) field header. One JS string char per raw byte (MSB-first,
 * bit 1 = black — `Bitmap`'s standard convention, unmodified), no length
 * prefix and no hex re-encoding — same "one char per byte" convention
 * `DplEncoder.ts`'s/`EplEncoder.ts`'s `encode*BitmapPayload()` use, since
 * `IplCompiler` builds the whole document as one `string`, not bytes.
 *
 * CONFIDENCE — LOW, flagged for hardware verification before relying on it.
 * Unlike Task 2 (EPL) and Task 4 (DPL), where portakal's own image case at
 * least had a plausible header shape and was only missing the payload,
 * portakal's `languages/ipl.ts` image case is a near-stub: it emits only
 * `{STX}G{fieldNum};o{x},{y};f0{ETX}` — no width, no height, no data at
 * all — so there is no portakal ground truth for the Graphic field's real
 * clause layout to extend here.
 *
 * This encoder (and its caller, `IplCompiler`'s `'image'` case, which adds
 * `;w{bytesPerRow};h{height};` before the payload) is a reconstruction, not
 * a verified port: it extends portakal's known header fragment with the
 * same single-letter `;`-separated clause grammar this codebase's own `H`
 * (text) and `W` (box) field commands already use for their own
 * dimensions, on the reasoning that a printer language this consistent
 * about its own field syntax likely extends that syntax to its graphic
 * field too. That reasoning is plausible but NOT confirmed against an
 * Intermec/Honeywell IPL Programmer's Reference Manual — the real field
 * name, clause letters, clause order, and byte layout may differ from what
 * is implemented here.
 *
 * What IS certain: the bug this task must fix — portakal's total absence of
 * width/height/payload in the image case — is fixed. Real, byte-accurate
 * bitmap data now follows the header, byte for byte, matching
 * `bitmap.data`. Treat the exact command syntax as a documented,
 * consistent placeholder pending hardware/manual verification, not a
 * confirmed wire format.
 */
export function encodeIplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    payload += String.fromCharCode(bitmap.data[i]);
  }
  return payload;
}
