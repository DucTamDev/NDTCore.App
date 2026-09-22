/** Bộ lệnh dùng ở đây là Star Line Mode, không phải giao thức StarPRNT mới hơn của Star Micronics. */
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

// ESC GS a n: n=0 trái, n=1 giữa, n=2 phải.
export const STAR_PRNT_ALIGN_VALUE = {
  LEFT: 0,
  CENTER: 1,
  RIGHT: 2,
} as const;

export const STAR_PRNT_UNDERLINE_VALUE = {
  OFF: 0,
  ON: 1,
} as const;

/** ESC i h w dùng hệ số 1 để biểu diễn "không phóng to" (cỡ chữ mặc định). */
export const STAR_PRNT_DEFAULT_MAGNIFICATION = 1;

/** Giá trị "n" duy nhất mà ESC d n phát ra ở đây — xem compileCutElement để biết lý do. */
export const STAR_PRNT_CUT_VALUE = 1;

export const BYTE_MASK = 0xff;

export const BITS_PER_BYTE = 8;

export const BYTE_VALUE_RANGE = 256;

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
