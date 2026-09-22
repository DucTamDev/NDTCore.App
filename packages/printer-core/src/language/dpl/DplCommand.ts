/**
 * Hằng số tiền tố lệnh cấp tài liệu của DPL (Honeywell/Datamax).
 * Bản ghi phần tử (text/box/line/...) của DPL là các trường chữ số độ rộng
 * cố định thay vì lệnh có tiền tố chữ cái, nên chỉ lệnh thiết lập/kết thúc
 * cấp tài liệu và chữ cái đánh dấu loại bản ghi mới có hằng số ở đây — bố
 * cục trường số nằm inline trong `DplCompiler.ts`.
 */
export const DPL_COMMAND = {
  /** `<STX>L` — mọi nhãn DPL đều bắt đầu bằng lệnh này. */
  ENTER_LABEL_FORMAT: '\x02L',
  DENSITY: 'D',
  SPEED: 'S',
  /** `A` — Form Width, tính bằng dots; ký tự lệnh không phải viết tắt của "Width". */
  WIDTH: 'A',
  QUANTITY: 'Q',
  /** `E` — vừa kết thúc chế độ định dạng nhãn vừa lệnh cho máy in nhãn ra. */
  END: 'E',
  /** Chữ cái đánh dấu cuối bản ghi Line/Box Draw. */
  LINE_BOX_MARKER: 'l',
} as const;

export type DplCommandName = (typeof DPL_COMMAND)[keyof typeof DPL_COMMAND];
