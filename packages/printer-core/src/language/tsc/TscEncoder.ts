import type { Bitmap } from '../../types';

/**
 * Mã hoá một bitmap đơn sắc thành payload mà lệnh TSPL2 `BITMAP` yêu cầu
 * ngay sau dấu phẩy cuối cùng của nó: đúng `bitmap.bytesPerRow *
 * bitmap.height` byte nhị phân thô (MSB trước, bit 1 = đen), không có tiền
 * tố độ dài hay mã hoá lại dạng hex-ASCII — hai trường `bytesPerRow`/`height`
 * trong header đã đủ cho máy in biết cần đọc tiếp bao nhiêu byte.
 *
 * `compileToTSC()` của portakal dựng cả tài liệu thành một `string` duy
 * nhất, nên `TscCompiler` giữ theo cách đó thay vì chuyển sang mảng byte chỉ
 * riêng cho lệnh này — mỗi byte payload được mang bằng một char code thô
 * (0-255), cùng quy ước "một ký tự string = một byte" mà `EscPosValidator`
 * cũng đang dùng để duyệt một chuỗi nguồn như một luồng byte.
 */
export function encodeTscBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    payload += String.fromCharCode(bitmap.data[i]);
  }
  return payload;
}
