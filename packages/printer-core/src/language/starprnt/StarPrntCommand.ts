/**
 * Hằng số byte lệnh của Star Line Mode, theo bộ lệnh Line Mode của Star
 * Micronics (cách bố trí byte này được cả `languages/starprnt.ts` và
 * `parsers/starprnt.ts` của portakal mã hoá/giải mã). Dùng chung cho
 * compiler, encoder ảnh và parser.
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

/** Giá trị tham số "n" của lệnh căn lề ESC GS a: 0 = trái, 1 = giữa, 2 = phải. */
export const STAR_PRNT_ALIGN_VALUE = {
  LEFT: 0,
  CENTER: 1,
  RIGHT: 2,
} as const;

/** Giá trị bật/tắt cho lệnh gạch chân ESC - n. */
export const STAR_PRNT_UNDERLINE_VALUE = {
  OFF: 0,
  ON: 1,
} as const;

/** Hệ số phóng to mặc định (1x), dùng để đưa lệnh ESC i h w về lại cỡ chữ bình thường. */
export const STAR_PRNT_DEFAULT_MAGNIFICATION = 1;

/** Giá trị "n" duy nhất mà lệnh cắt giấy ESC d n phát ra trong compiler này — xem StarPrntCompiler. */
export const STAR_PRNT_CUT_VALUE = 1;

/** Mặt nạ 1 byte, dùng khi tách/ghép số 2-byte little-endian theo định dạng "b nL nH data". */
export const BYTE_MASK = 0xff;

/** Số bit của 1 byte — dùng khi dịch bit để tách byte thấp/byte cao của số 2-byte little-endian. */
export const BITS_PER_BYTE = 8;

/** Miền giá trị của 1 byte (0..255), dùng khi ghép byte thấp/byte cao thành số 2-byte little-endian. */
export const BYTE_VALUE_RANGE = 256;

/**
 * Gộp các đoạn byte thành một Uint8Array duy nhất — cùng kiểu helper lắp
 * ráp với `concatEscPosBytes`.
 */
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
