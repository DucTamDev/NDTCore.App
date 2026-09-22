/**
 * Hằng số byte điều khiển ESC/POS, theo tài liệu Epson ESC/POS Application
 * Programming Guide. Dùng chung bởi compiler, các byte encoder, và validator
 * (validator duyệt lại chính các byte lệnh này để kiểm tra tính hợp lệ của stream).
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
  CUT: 0x56, // GS V m [n]
} as const;

/**
 * Nối các đoạn byte thành một Uint8Array — mọi encoder ESC/POS đều lắp ráp output theo cách này.
 */
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
