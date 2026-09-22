import type { Bitmap } from '../../types';

/**
 * Mã hoá một bitmap đơn sắc thành payload mà bản ghi ảnh của DPL cần ngay
 * sau header `1{col}{row}{h}{w}0005`: đúng `bitmap.bytesPerRow * bitmap.height`
 * byte nhị phân thô (MSB-first, bit 1 = đen — đúng quy ước chuẩn của
 * `Bitmap`, không chỉnh sửa gì), không có tiền tố độ dài hay mã hoá lại
 * dạng hex-ASCII — hai trường `h`/`w` trong header đã tự nói cho máy in biết
 * cần đọc bao nhiêu byte tiếp theo. Cùng quy ước "mỗi ký tự string ứng với
 * một byte" mà `encodeTscBitmapPayload()` của `TscEncoder.ts` và
 * `encodeEplBitmapPayload()` của `EplEncoder.ts` dùng, vì `DplCompiler` dựng
 * toàn bộ tài liệu thành một `string`, không phải bytes.
 *
 * Sửa một bug thật trong case ảnh của `languages/dpl.ts` bên portakal: nó
 * chỉ phát ra header cố định mà không kèm payload nào — một bản ghi thiếu mà
 * không máy in thật nào giải mã được. Cùng loại bug này đã được sửa ở đây
 * cho `BITMAP` của TSC và `GW` của EPL. Khác với `GW` của EPL2, portakal
 * không ghi nhận điểm bất thường đảo cực (inverted-polarity) nào cho bản ghi
 * ảnh của DPL, nên encoder này giữ nguyên cực tính chuẩn của `Bitmap`, không
 * đổi gì, giống như `encodeTscBitmapPayload()`.
 */
export function encodeDplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let byteIndex = 0; byteIndex < bitmap.data.length; byteIndex++) {
    payload += String.fromCharCode(bitmap.data[byteIndex]);
  }
  return payload;
}
