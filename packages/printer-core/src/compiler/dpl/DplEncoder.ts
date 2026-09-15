import type { Bitmap } from '../../types';

/**
 * Encode a monochrome bitmap as the payload DPL's image record expects
 * immediately after its `1{col}{row}{h}{w}0005` header: exactly
 * `bitmap.bytesPerRow * bitmap.height` raw binary bytes (MSB-first, bit 1 =
 * black — `Bitmap`'s standard convention, unmodified), with no length prefix
 * or hex-ASCII re-encoding — the header's own `h`/`w` fields already tell the
 * printer how many bytes to read next. Same "one string char per byte"
 * convention `TscEncoder.ts`'s `encodeTscBitmapPayload()` and
 * `EplEncoder.ts`'s `encodeEplBitmapPayload()` use, since `DplCompiler`
 * builds the whole document as one `string`, not bytes.
 *
 * Fixes a real bug in portakal's `languages/dpl.ts` image case: it emits
 * only the fixed header with no payload appended at all — an incomplete
 * record no real printer could decode. Same bug class Phase 1 fixed for
 * TSC's `BITMAP` and Task 2 fixed for EPL's `GW`. Unlike EPL2's `GW`,
 * portakal documents no inverted-polarity quirk for DPL's image record, so
 * this encoder carries `Bitmap`'s standard polarity through unchanged, same
 * as `encodeTscBitmapPayload()`.
 */
export function encodeDplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    payload += String.fromCharCode(bitmap.data[i]);
  }
  return payload;
}
