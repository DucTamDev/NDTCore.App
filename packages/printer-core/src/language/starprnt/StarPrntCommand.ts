/**
 * Star Line Mode control byte constants, per Star Micronics' Line Mode
 * command set (the byte layout portakal's `languages/starprnt.ts` and
 * `parsers/starprnt.ts` both encode/decode). Shared by the compiler, the
 * image encoder, and the validator.
 */
export const STAR_PRNT = {
  ESC: 0x1b,
  LF: 0x0a,

  INIT: 0x40, // ESC @
  ALIGN: [0x1d, 0x61] as const, // ESC GS a n
  BOLD_ON: 0x45, // ESC E
  BOLD_OFF: 0x46, // ESC F
  UNDERLINE: 0x2d, // ESC - n
  SIZE: 0x69, // ESC i h w
  CUT: 0x64, // ESC d n

  RASTER_ENTER: [0x2a, 0x72, 0x41] as const, // ESC * r A
  RASTER_EXIT: [0x2a, 0x72, 0x42] as const, // ESC * r B
  RASTER_LINE: 0x62, // b nL nH data

  CASH_DRAWER: 0x07, // BEL
} as const;

/** Concatenate byte chunks into one Uint8Array — same assembly helper shape as `concatEscPosBytes`. */
export function concatStarPrntBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
