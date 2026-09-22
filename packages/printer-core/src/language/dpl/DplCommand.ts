/**
 * Các hằng số tiền tố lệnh cho ngôn ngữ máy in DPL của Honeywell/Datamax,
 * được switch `compileElement()` của `DplCompiler` phát ra, cùng với các
 * lệnh thiết lập nhãn mà `compileToDPL()` ghi trước mọi phần tử — trích xuất
 * từ các chuỗi literal mà `languages/dpl.ts` của portakal dựng inline, cùng
 * kiểu "trích xuất chứ không phải logic mới" như `EplCommand.ts`/`ZplCommand.ts`.
 *
 * Các bản ghi phần tử của DPL là các trường chữ số độ rộng cố định thay vì
 * lệnh có tiền tố chữ cái (khác với `A`/`X`/`LO` của EPL2 hay
 * `^A`/`^GB`/`^GD` của ZPL), nên chỉ các lệnh thiết lập/kết thúc ở cấp tài
 * liệu và chữ cái đánh dấu loại bản ghi mới có hằng số đặt tên ở đây — bố
 * cục trường số vẫn nằm inline trong `DplCompiler.ts`, cạnh logic đệm số mà
 * nó thuộc về.
 */
export const DPL_COMMAND = {
  /**
   * `<STX>L` — Vào chế độ định dạng nhãn, phần header mọi nhãn DPL đều bắt
   * đầu bằng nó.
   */
  ENTER_LABEL_FORMAT: '\x02L',
  /** `D` — Đặt độ đậm (Darkness/Density). */
  DENSITY: 'D',
  /** `S` — Đặt tốc độ in (Print Speed). */
  SPEED: 'S',
  /** `A` — Đặt chiều rộng nhãn (Form Width), tính bằng dots. */
  WIDTH: 'A',
  /** `Q` — Đặt số lượng bản in (copies). */
  QUANTITY: 'Q',
  /** `E` — Kết thúc chế độ định dạng nhãn, lệnh in nhãn ra. */
  END: 'E',
  /**
   * Chữ cái đánh dấu loại bản ghi ở cuối bản ghi Line/Box Draw (hậu tố
   * `2l`/`0002l` của portakal đều tận cùng bằng nó).
   */
  LINE_BOX_MARKER: 'l',
} as const;

export type DplCommandName = (typeof DPL_COMMAND)[keyof typeof DPL_COMMAND];
