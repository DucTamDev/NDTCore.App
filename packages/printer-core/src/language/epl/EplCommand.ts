/**
 * Các tiền tố lệnh EPL2 mà switch `compileElement()` của `EplCompiler` phát
 * ra, cùng các lệnh thiết lập nhãn mà `compileToEPL()` ghi trước mỗi phần tử.
 * Gom vào một map hằng số có tên (giống cách làm của `ZPL_COMMAND` và
 * `TSC_COMMAND`) để mỗi tiền tố lệnh chỉ xuất hiện một chỗ duy nhất.
 *
 * Text (`A`) và box (`X`)/line (`LO`) chỉ có một tiền tố cố định (khác với
 * `^A<letter>`/`^B<letter>` của ZPL, EPL2 không đổi ký tự thứ hai theo loại),
 * nên được khai báo thẳng ở đây thay vì dựng tại nơi gọi.
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
  /**
   * `B` — trường mã vạch 1D, theo EPL2 Programmer's Guide. Mới hoàn toàn —
   * portakal chưa từng compile phần tử barcode cho EPL.
   */
  BARCODE: 'B',
  /**
   * `b` — trường mã vạch 2D (chữ thường, khác với `B` của mã vạch 1D). Mới
   * hoàn toàn — cùng lý do với `BARCODE`.
   */
  TWO_D_BARCODE: 'b',
} as const;

export type EplCommandName = (typeof EPL_COMMAND)[keyof typeof EPL_COMMAND];
