import type { Bitmap } from '../../types';

/**
 * Mã hoá bitmap đơn sắc thành payload ASCII-hex mà trường `<ESC>GM` (Graphics)
 * của SBPL yêu cầu: mỗi byte `bitmap.data` (MSB-first, bit 1 = đen, đúng quy
 * ước của `Bitmap` — không cần đảo bit) được biểu diễn bằng 2 chữ số hex viết
 * hoa nối liền nhau, không có ký tự phân cách — cùng dạng ASCII-hex mà `EG`
 * của CPCL và `^GFA` của ZPL dùng.
 */
export function encodeSbplBitmapPayload(bitmap: Bitmap): string {
  let hex = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    hex += bitmap.data[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}
