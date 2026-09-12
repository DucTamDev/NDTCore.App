import { PrinterErrorException, PrinterErrorCode } from '../errors/PrinterError';

/**
 * Bảng tra pattern Code 128 Code-Set-B, chuẩn ISO/IEC 15417 — 103 symbol
 * (0-102) + Start A(103)/Start B(104)/Start C(105), mỗi symbol 6 chữ số độ
 * rộng module (bar,space,bar,space,bar,space); Stop(106) riêng, 7 chữ số.
 *
 * CHÉP LẠI TỪ TRÍ NHỚ — chưa đối chiếu với bản in ISO gốc. Bắt buộc verify
 * bằng máy quét mã vạch thật (điện thoại) trước khi coi tính năng này xong
 * (xem Task 4 Step cuối trong plan) — sai 1 symbol vẫn tạo ra ảnh "trông như
 * barcode" nhưng quét sai/không quét được, lỗi dạng này review code không
 * bắt được.
 */
const CODE128B_PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], [2, 2, 2, 1, 2, 2], [2, 2, 2, 2, 2, 1], [1, 2, 1, 2, 2, 3],
  [1, 2, 1, 3, 2, 2], [1, 3, 1, 2, 2, 2], [1, 2, 2, 2, 1, 3], [1, 2, 2, 3, 1, 2],
  [1, 3, 2, 2, 1, 2], [2, 2, 1, 2, 1, 3], [2, 2, 1, 3, 1, 2], [2, 3, 1, 2, 1, 2],
  [1, 1, 2, 2, 3, 2], [1, 2, 2, 1, 3, 2], [1, 2, 2, 2, 3, 1], [1, 1, 3, 2, 2, 2],
  [1, 2, 3, 1, 2, 2], [1, 2, 3, 2, 2, 1], [2, 2, 3, 2, 1, 1], [2, 2, 1, 1, 3, 2],
  [2, 2, 1, 2, 3, 1], [2, 1, 3, 2, 1, 2], [2, 2, 3, 1, 1, 2], [3, 1, 2, 1, 3, 1],
  [3, 1, 1, 2, 2, 2], [3, 2, 1, 1, 2, 2], [3, 2, 1, 2, 2, 1], [3, 1, 2, 2, 1, 2],
  [3, 2, 2, 1, 1, 2], [3, 2, 2, 2, 1, 1], [2, 1, 2, 1, 2, 3], [2, 1, 2, 3, 2, 1],
  [2, 3, 2, 1, 2, 1], [1, 1, 1, 3, 2, 3], [1, 3, 1, 1, 2, 3], [1, 3, 1, 3, 2, 1],
  [1, 1, 2, 3, 1, 3], [1, 3, 2, 1, 1, 3], [1, 3, 2, 3, 1, 1], [2, 1, 1, 3, 1, 3],
  [2, 3, 1, 1, 1, 3], [2, 3, 1, 3, 1, 1], [1, 1, 2, 1, 3, 3], [1, 1, 2, 3, 3, 1],
  [1, 3, 2, 1, 3, 1], [1, 1, 3, 1, 2, 3], [1, 1, 3, 3, 2, 1], [1, 3, 3, 1, 2, 1],
  [3, 1, 3, 1, 2, 1], [2, 1, 1, 3, 3, 1], [2, 3, 1, 1, 3, 1], [2, 1, 3, 1, 1, 3],
  [2, 1, 3, 3, 1, 1], [2, 1, 3, 1, 3, 1], [3, 1, 1, 1, 2, 3], [3, 1, 1, 3, 2, 1],
  [3, 3, 1, 1, 2, 1], [3, 1, 2, 1, 1, 3], [3, 1, 2, 3, 1, 1], [3, 3, 2, 1, 1, 1],
  [3, 1, 4, 1, 1, 1], [2, 2, 1, 4, 1, 1], [4, 3, 1, 1, 1, 1], [1, 1, 1, 2, 2, 4],
  [1, 1, 1, 4, 2, 2], [1, 2, 1, 1, 2, 4], [1, 2, 1, 4, 2, 1], [1, 4, 1, 1, 2, 2],
  [1, 4, 1, 2, 2, 1], [1, 1, 2, 2, 1, 4], [1, 1, 2, 4, 1, 2], [1, 2, 2, 1, 1, 4],
  [1, 2, 2, 4, 1, 1], [1, 4, 2, 1, 1, 2], [1, 4, 2, 2, 1, 1], [2, 4, 1, 2, 1, 1],
  [2, 2, 1, 1, 1, 4], [4, 1, 3, 1, 1, 1], [2, 4, 1, 1, 1, 2], [1, 3, 4, 1, 1, 1],
  [1, 1, 1, 2, 4, 2], [1, 2, 1, 1, 4, 2], [1, 2, 1, 2, 4, 1], [1, 1, 4, 2, 1, 2],
  [1, 2, 4, 1, 1, 2], [1, 2, 4, 2, 1, 1], [4, 1, 1, 2, 1, 2], [4, 2, 1, 1, 1, 2],
  [4, 2, 1, 2, 1, 1], [2, 1, 2, 1, 4, 1], [2, 1, 4, 1, 2, 1], [4, 1, 2, 1, 2, 1],
  [1, 1, 1, 1, 4, 3], [1, 1, 1, 3, 4, 1], [1, 3, 1, 1, 4, 1], [1, 1, 4, 1, 1, 3],
  [1, 1, 4, 3, 1, 1], [4, 1, 1, 1, 1, 3], [4, 1, 1, 3, 1, 1], [1, 1, 3, 1, 4, 1],
  [1, 1, 4, 1, 3, 1], [3, 1, 1, 1, 4, 1], [4, 1, 1, 1, 3, 1],
  [2, 1, 1, 4, 1, 2], [2, 1, 1, 2, 1, 4], [2, 1, 1, 2, 3, 2],
];

const START_B = 104;
const STOP_PATTERN = [2, 3, 3, 1, 1, 1, 2];

/**
 * Encode 1 chuỗi qua Code 128 Code Set B (ASCII 32-126 → code 0-94).
 * Trả về chuỗi độ rộng module bar/space (bắt đầu bằng bar) đã bao gồm
 * Start B + data + checksum + Stop, cùng tổng số module (để caller tự tính
 * bề rộng vẽ ra pixel: `totalModules * moduleWidthPx`).
 */
export const encodeCode128 = (content: string): { widths: number[]; totalModules: number } => {
  if (content.length === 0) {
    // VALIDATION_ERROR — the plan brief specified a nonexistent INVALID_ARGUMENT code;
    // this is the corrected, accepted choice per the code review ruling.
    throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Nội dung barcode không được rỗng' });
  }

  const codes: number[] = [START_B];

  for (const char of content) {
    const codePoint = char.codePointAt(0) ?? -1;
    if (codePoint < 32 || codePoint > 126) {
      // VALIDATION_ERROR — the plan brief specified a nonexistent INVALID_ARGUMENT code;
      // this is the corrected, accepted choice per the code review ruling.
      throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: `Ký tự "${char}" không hỗ trợ trong Code128 Set B (cần ASCII 32-126)` });
    }
    codes.push(codePoint - 32);
  }

  let checksum = codes[0];
  for (let i = 1; i < codes.length; i += 1) {
    checksum += codes[i] * i;
  }
  codes.push(checksum % 103);

  const widths: number[] = [];
  for (const code of codes) {
    widths.push(...CODE128B_PATTERNS[code]);
  }
  widths.push(...STOP_PATTERN);

  return { widths, totalModules: widths.reduce((sum, w) => sum + w, 0) };
};
