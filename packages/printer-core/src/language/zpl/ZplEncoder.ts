import type { Bitmap } from '../../types';

/**
 * Encode bitmap đơn sắc thành payload ASCII-hex mà lệnh ZPL `^GFA` yêu cầu:
 * mỗi byte đã đóng gói của `bitmap.data` (MSB-first, bit 1 = đen, cùng quy
 * ước mà `Bitmap` dùng xuyên suốt package này) được render thành hai chữ số
 * hex viết hoa, nối liền nhau không có ký tự phân cách — tham số `a` của
 * `^GFA` (nén ASCII-hex) chính là thứ báo cho máy in giải mã phần text theo
 * sau trở lại thành nhị phân theo cách này, theo lệnh Graphic Field trong
 * Zebra ZPL II Programming Guide.
 *
 * Port trực tiếp, không chỉnh sửa, từ vòng lặp hex xử lý case image trong
 * `languages/zpl.ts` của portakal — plan đánh dấu đoạn này vốn đã đúng,
 * không cần sửa lỗi ở đây, khác với các lệnh tương đương `^GFA` của
 * EPL/DPL/IPL ở các task sau.
 */
export function encodeZplBitmapPayload(bitmap: Bitmap): string {
  let hex = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    hex += bitmap.data[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}
