import type { Bitmap } from '../../types';

/**
 * Encode bitmap đơn sắc thành payload ASCII-hex mà lệnh ZPL `^GFA` (Graphic Field,
 * nén ASCII-hex) yêu cầu: mỗi byte của `bitmap.data` (MSB-first, bit 1 = đen) render
 * thành hai chữ số hex viết hoa nối liền nhau, không có ký tự phân cách.
 */
export function encodeZplBitmapPayload(bitmap: Bitmap): string {
  let hex = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    hex += bitmap.data[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}
