import type { Bitmap } from '../../types';

/**
 * Mã hoá bitmap đơn sắc thành payload ASCII-hex mà lệnh `EG` (Expanded
 * Graphics) của CPCL cần: mỗi byte đã đóng gói trong `bitmap.data`
 * (MSB-first, bit 1 = đen — cực tính `EG` của CPCL khớp thẳng với quy ước
 * chuẩn của `Bitmap`, không cần đảo bit như `GW` của EPL2) được biểu diễn
 * bằng hai chữ số hex viết hoa, nối liền không dấu phân cách — cùng dạng
 * ASCII-hex mà `^GFA` của ZPL dùng, theo mục Expanded Graphics của CPCL
 * Programmer's Manual.
 */
export function encodeCpclBitmapPayload(bitmap: Bitmap): string {
  let hex = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    hex += bitmap.data[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}
