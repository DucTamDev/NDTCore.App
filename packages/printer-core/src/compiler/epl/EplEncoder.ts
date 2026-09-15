import type { Bitmap } from '../../types';

/**
 * Encode a monochrome bitmap as the payload the EPL2 `GW` command expects
 * immediately after its trailing comma: exactly `bitmap.bytesPerRow *
 * bitmap.height` raw binary bytes, with no length prefix or hex-ASCII
 * re-encoding — `GW`'s own `p3`/`p4` (bytes-per-row/height) header fields
 * already tell the printer how many bytes to read next, per the EPL2
 * Programmer's Guide's Graphic Write command (`GW p1,p2,p3,p4,<data>`), the
 * same raw-binary-after-trailing-comma shape as TSPL's `BITMAP` — see
 * `TscEncoder.ts`'s `encodeTscBitmapPayload()`, this fix's direct structural
 * reference.
 *
 * Fixes a real bug in portakal's `languages/epl.ts` image case: it emits
 * only the `GW x,y,bytesPerRow,height` header (no trailing comma, no
 * payload) — an incomplete command no real printer can decode. Same bug
 * class Phase 1 fixed for TSC's `BITMAP`.
 *
 * Polarity is inverted relative to `Bitmap`'s own standard convention
 * (MSB-first, bit 1 = black, the convention `ZplEncoder`'s `^GF` and
 * `TscEncoder`'s `BITMAP` both use as-is): `GW` wants 0=black, 1=white, per
 * portakal's own `src/lang/epl.ts` file header ("GW image polarity:
 * INVERTED (0=black, 1=white)"), a documented EPL2 hardware quirk, not a
 * portakal bug. Each byte is bit-inverted (`^ 0xff`) right here, at the
 * point the payload is built for the wire — same pattern (and same
 * eslint-disable justification) this repo's own
 * `src/features/printer/drivers/tspl/TsplEncoder.ts` `image()` uses for its
 * own printer-specific polarity quirk — so `Bitmap`/`encodeZplBitmapPayload`/
 * `encodeTscBitmapPayload` keep the one standard polarity everywhere else in
 * this package, and only `GW`'s own genuinely-inverted wire format is
 * special-cased.
 */
export function encodeEplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    // eslint-disable-next-line no-bitwise -- intentional bit inversion for GW's inverted polarity, see doc comment above
    payload += String.fromCharCode(bitmap.data[i] ^ 0xff);
  }
  return payload;
}
