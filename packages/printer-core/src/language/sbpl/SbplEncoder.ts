import type { Bitmap } from '../../types';

/**
 * Mã hoá bitmap đơn sắc thành payload ASCII-hex mà trường `<ESC>GM` (Graphics)
 * của SBPL yêu cầu: mỗi byte đã đóng gói của `bitmap.data` (MSB-first, bit 1 =
 * đen — đúng quy ước chuẩn của `Bitmap`, không cần đảo bit) được biểu diễn
 * bằng 2 chữ số hex viết hoa, nối liền nhau không có ký tự phân cách — cùng
 * dạng ASCII-hex mà `EG` của CPCL và `^GFA` của ZPL dùng.
 *
 * Port trực tiếp, không thay đổi, từ vòng lặp hex của case ảnh trong
 * `languages/sbpl.ts` của portakal — plan đã đánh dấu đoạn này vốn đã đúng,
 * không cần sửa lỗi như các lệnh bitmap của EPL2/TSC/DPL/IPL.
 */
export function encodeSbplBitmapPayload(bitmap: Bitmap): string {
  let hex = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    hex += bitmap.data[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}
