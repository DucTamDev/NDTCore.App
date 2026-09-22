/**
 * Các hằng số tiền tố lệnh ZPL II mà switch `compileElement()` của
 * `ZplCompiler` phát ra, cùng các lệnh thiết lập format mà `compileToZPL()`
 * ghi trước mỗi element. Gom thành một map hằng số duy nhất (giống
 * `TSC_COMMAND` và `ESC_POS`) để mỗi tiền tố lệnh chỉ được viết ra một nơi —
 * chuyển thể từ các chuỗi literal mà `languages/zpl.ts` của portakal dựng
 * trực tiếp trong code.
 *
 * Lệnh font (`^A<letter>`) và barcode (`^B<letter>`) không liệt kê ở đây —
 * ký tự thứ hai của chúng thay đổi theo từng lần gọi (id font / loại mã
 * vạch), nên `ZplCompiler` tự dựng các lệnh này trực tiếp tại nơi gọi, giống
 * cách `TSC_BARCODE_TYPE` của `TscCompiler` xử lý chuỗi loại mã vạch riêng
 * cho từng symbology của TSPL.
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
   * `^MM` — Print Mode. `^MMC` chọn chế độ Cutter (có tính bền — máy in tiếp
   * tục cắt sau mỗi label cho đến khi chế độ bị đổi lại, cùng mô hình bền
   * trạng thái như `SET CUTTER` của TSC), `^MMT` quay lại Tear-off (trạng
   * thái mặc định của ZPL, không cắt). Hoàn toàn mới — portakal không bao
   * giờ compile element `cut` cho ZPL — lệnh này được lấy từ `^MM` trong
   * Zebra ZPL II Programming Guide, lệnh chế độ cắt thật cho máy in có dao
   * cắt.
   */
  PRINT_MODE: '^MM',
} as const;

export type ZplCommandName = (typeof ZPL_COMMAND)[keyof typeof ZPL_COMMAND];
