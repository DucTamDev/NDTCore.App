/**
 * Tiền tố lệnh ZPL II dùng trong `ZplCompiler`.
 *
 * Lệnh font (`^A<letter>`) và barcode (`^B<letter>`) không liệt kê ở đây vì
 * ký tự thứ hai thay đổi theo từng lần gọi (id font / loại mã vạch).
 */
export const ZPL_COMMAND = {
  START_FORMAT: '^XA',
  END_FORMAT: '^XZ',
  PRINT_WIDTH: '^PW',
  LABEL_LENGTH: '^LL',
  PRINT_RATE: '^PR',
  DARKNESS: '~SD',
  CHANGE_INTL_FONT_ENCODING: '^CI',
  FIELD_ORIGIN: '^FO',
  FIELD_TYPESET: '^FT',
  FIELD_DATA: '^FD',
  FIELD_SEPARATOR: '^FS',
  FIELD_BLOCK: '^FB',
  FIELD_REVERSE: '^FR',
  GRAPHIC_BOX: '^GB',
  GRAPHIC_CIRCLE: '^GC',
  GRAPHIC_DIAGONAL: '^GD',
  GRAPHIC_FIELD_ASCII: '^GFA',
  BARCODE_FIELD_DEFAULT: '^BY',
  PRINT_QUANTITY: '^PQ',
  /**
   * `^MM` — Print Mode. `^MMC` chọn Cutter: một khi bật, máy in tiếp tục cắt
   * sau mỗi label cho đến khi đổi lại; `^MMT` quay về Tear-off (mặc định,
   * không cắt).
   */
  PRINT_MODE: '^MM',
} as const;

export type ZplCommandName = (typeof ZPL_COMMAND)[keyof typeof ZPL_COMMAND];
