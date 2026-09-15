/**
 * ESC/POS control byte constants, per the Epson ESC/POS Application
 * Programming Guide. Shared by the compiler, byte encoders, and the
 * validator (which walks the same command bytes to sanity-check a stream).
 */
export const ESC_POS = {
  ESC: 0x1b,
  GS: 0x1d,
  LF: 0x0a,

  INIT: 0x40, // ESC @
  ALIGN: 0x61, // ESC a n
  BOLD: 0x45, // ESC E n
  UNDERLINE: 0x2d, // ESC - n
  LINE_SPACING_SET: 0x33, // ESC 3 n
  LINE_SPACING_DEFAULT: 0x32, // ESC 2

  SIZE: 0x21, // GS ! n
  REVERSE: 0x42, // GS B n
  HRI_POSITION: 0x48, // GS H n
  BARCODE_HEIGHT: 0x68, // GS h n
  BARCODE_WIDTH: 0x77, // GS w n
  BARCODE: 0x6b, // GS k m [n] data
  RASTER_IMAGE: [0x76, 0x30], // GS v 0
  TWO_D_CODE: [0x28, 0x6b], // GS ( k
} as const;

/** Concatenate byte chunks into one Uint8Array — every ESC/POS encoder assembles its output this way. */
export function concatEscPosBytes(chunks: Uint8Array[]): Uint8Array {
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
