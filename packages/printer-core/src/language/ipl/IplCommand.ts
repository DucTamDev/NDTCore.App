/**
 * IPL đóng khung mỗi lệnh giữa `STX`/`ETX`. Field command tách clause bằng
 * `;`, mỗi clause dẫn đầu bởi một chữ cái thường (`o`=origin, `f`=format/
 * rotation, `l`=length, `h`/`w`=cặp kích thước mà ý nghĩa tuỳ loại field).
 * Lệnh tiền tố `ESC` (`C`/`P`/`E`/`M`) không có clause. Chữ cái loại field
 * (`FIELD_*`) và chữ cái lệnh cấu hình `<SI>` (`CONFIG_*`) là hai namespace
 * độc lập, có thể trùng ký tự (`L`, `W`) mà không liên quan tới nhau.
 */
export const IPL_COMMAND = {
  STX: '\x02',
  ETX: '\x03',
  ESC: '\x1b',
  /** `<ESC>C1` — header mở đầu mọi label được compile. */
  CREATE_FORMAT: 'C1',
  PROGRAM_MODE: 'P',
  /** `<ESC>E1` — trailer kết thúc mọi label được compile. */
  END_FORMAT: 'E1',
  COPIES: 'M',
  PRINT: 'R',
  FIELD_TEXT: 'H',
  FIELD_BOX: 'W',
  FIELD_LINE: 'L',
  FIELD_GRAPHIC: 'G',
  /** `<SI>L{n}` — đơn vị dots. */
  CONFIG_LENGTH: 'L',
  /** `<SI>W{n}` — đơn vị dots. */
  CONFIG_WIDTH: 'W',
  CONFIG_SPEED: 'S',
  CONFIG_DENSITY: 'd',
} as const;

export type IplCommandName = (typeof IPL_COMMAND)[keyof typeof IPL_COMMAND];
