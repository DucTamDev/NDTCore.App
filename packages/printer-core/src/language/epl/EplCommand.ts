/**
 * Tiền tố lệnh EPL2 do `EplCompiler` phát ra. Khác với `^A<letter>` của ZPL,
 * EPL2 dùng đúng một ký tự cố định cho text (`A`) và box/line, không đổi theo loại.
 */
export const EPL_COMMAND = {
  CLEAR_IMAGE_BUFFER: 'N',
  LABEL_WIDTH: 'q',
  LABEL_HEIGHT_GAP: 'Q',
  SPEED: 'S',
  DENSITY: 'D',
  TEXT: 'A',
  IMAGE: 'GW',
  BOX: 'X',
  LINE: 'LO',
  PRINT: 'P',
  BARCODE: 'B',
  TWO_D_BARCODE: 'b',
} as const;

export type EplCommandName = (typeof EPL_COMMAND)[keyof typeof EPL_COMMAND];
