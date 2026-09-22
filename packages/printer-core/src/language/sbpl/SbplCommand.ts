/**
 * Hằng số ký tự lệnh SBPL (SATO). Mọi lệnh đều có tiền tố `<ESC>` (0x1B).
 */
export const SBPL_COMMAND = {
  ESC: '\x1b',
  /** `A` — Start of Format, mở một phiên nhãn in. */
  START: 'A',
  /** `CS` — Xoá bộ đệm ảnh. */
  CLEAR: 'CS',
  /** `H` — Đặt toạ độ ngang (X), trường 4 chữ số. */
  POSITION_X: 'H',
  /** `V` — Đặt toạ độ dọc (Y), trường 4 chữ số. */
  POSITION_Y: 'V',
  /** `L` — Đặt hệ số phóng đại ký tự (ngang rồi đến dọc, mỗi bên 2 chữ số). */
  MAGNIFICATION: 'L',
  /** `K9B` — Trường text, font 9B (ASCII/Kanji hỗn hợp). */
  TEXT: 'K9B',
  /** `FW` — Trường vẽ đường/hộp. */
  DRAW: 'FW',
  /** `GM` — Trường đồ hoạ (bitmap). */
  IMAGE: 'GM',
  /** `Q` — Số lượng bản in, bỏ qua hoàn toàn nếu chỉ in 1 bản. */
  QUANTITY: 'Q',
  /** `Z` — End of Format, in nhãn. */
  END: 'Z',
} as const;

export type SbplCommandName = (typeof SBPL_COMMAND)[keyof typeof SBPL_COMMAND];
