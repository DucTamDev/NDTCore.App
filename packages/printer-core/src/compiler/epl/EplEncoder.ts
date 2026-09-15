import type { Bitmap } from '../../types';

/**
 * Encode a monochrome bitmap as the payload the EPL2 `GW` command expects
 * immediately after its trailing comma: exactly `bitmap.bytesPerRow *
 * bitmap.height` raw binary bytes (MSB-first, bit 1 = black, same convention
 * `Bitmap` uses everywhere else in this package), with no length prefix or
 * hex-ASCII re-encoding — `GW`'s own `p3`/`p4` (bytes-per-row/height) header
 * fields already tell the printer how many bytes to read next, per the EPL2
 * Programmer's Guide's Graphic Write command (`GW p1,p2,p3,p4,<data>`), the
 * same raw-binary-after-trailing-comma shape as TSPL's `BITMAP` — see
 * `TscEncoder.ts`'s `encodeTscBitmapPayload()`, this fix's direct structural
 * reference.
 *
 * Fixes a real bug in portakal's `languages/epl.ts` image case: it emits
 * only the `GW x,y,bytesPerRow,height` header (no trailing comma, no
 * payload) — an incomplete command no real printer can decode. Same bug
 * class Phase 1 fixed for TSC's `BITMAP`.
 */
export function encodeEplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    payload += String.fromCharCode(bitmap.data[i]);
  }
  return payload;
}
