/**
 * Các byte đóng khung và chữ cái loại field của ngôn ngữ máy in IPL
 * (Intermec/Honeywell), trích xuất từ các ký tự literal mà
 * `IplCompiler`'s `compileElement()`/`compileToIPL()` dựng inline — cùng
 * kiểu "chỉ trích xuất, không thêm logic mới" như `DplCommand.ts`/`EplCommand.ts`.
 *
 * IPL đóng khung mỗi lệnh giữa `STX`/`ETX` và tách các clause của một field
 * command bằng `;`, mỗi clause dẫn đầu bởi một chữ cái thường (`o` = origin,
 * `f` = format/rotation, `l` = length, `h`/`w` = một cặp kích thước mà ý
 * nghĩa chính xác tuỳ theo loại field — `H`'s `h`/`w` là font height/width,
 * `W`'s `h`/`w` là box height/stroke weight, `L`'s `w` là stroke weight).
 * Các lệnh có tiền tố `ESC` (`C`reate format, `P`rogram mode, `E`nd format,
 * `M` copies) không mang cú pháp clause riêng.
 */
export const IPL_COMMAND = {
  /** `\x02` — Start of frame, mở đầu mọi lệnh IPL. */
  STX: '\x02',
  /** `\x03` — End of frame, kết thúc mọi lệnh IPL. */
  ETX: '\x03',
  /** `\x1b` — Tiền tố cho các lệnh vòng đời format (`C`/`P`/`E`/`M`). */
  ESC: '\x1b',
  /** `<ESC>C1` — Create format 1, header mở đầu mọi label được compile. */
  CREATE_FORMAT: 'C1',
  /** `<ESC>P` — Vào program mode. */
  PROGRAM_MODE: 'P',
  /** `<ESC>E1` — End format 1, trailer kết thúc mọi label được compile. */
  END_FORMAT: 'E1',
  /** `<ESC>M{n}` — Đặt số bản copy khi in. */
  COPIES: 'M',
  /** `R` — In format đã lắp ráp. */
  PRINT: 'R',
  /** `H` — Field văn bản (human-readable text). */
  FIELD_TEXT: 'H',
  /** `W` — Field box (khung chữ nhật). */
  FIELD_BOX: 'W',
  /** `L` — Field đường thẳng (line). */
  FIELD_LINE: 'L',
  /** `G` — Field đồ hoạ (graphic/image). */
  FIELD_GRAPHIC: 'G',
  /** `<SI>L{n}` — Đặt chiều dài (height) label, tính bằng dots. */
  CONFIG_LENGTH: 'L',
  /** `<SI>W{n}` — Đặt chiều rộng (width) label, tính bằng dots. */
  CONFIG_WIDTH: 'W',
  /** `<SI>S{n}` — Đặt tốc độ in. */
  CONFIG_SPEED: 'S',
  /** `<SI>d{n}` — Đặt độ đậm/mật độ in. */
  CONFIG_DENSITY: 'd',
} as const;

export type IplCommandName = (typeof IPL_COMMAND)[keyof typeof IPL_COMMAND];
