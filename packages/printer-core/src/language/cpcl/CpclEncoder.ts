import type { Bitmap } from '../../types';

/**
 * Payload ASCII-hex mà lệnh `EG` (Expanded Graphics) của CPCL cần, theo CPCL
 * Programmer's Manual: mỗi byte hai chữ số hex viết hoa, nối liền không dấu
 * phân cách. Cực tính bit 1 = đen của `EG` khớp thẳng quy ước `Bitmap` —
 * không cần đảo bit như `GW` của EPL2.
 */
export function encodeCpclBitmapPayload(bitmap: Bitmap): string {
  let hex = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    hex += bitmap.data[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}
