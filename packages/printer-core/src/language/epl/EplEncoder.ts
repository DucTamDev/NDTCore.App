import type { Bitmap } from '../../types';

/**
 * Payload cho lệnh EPL2 `GW p1,p2,p3,p4,<data>` (Graphic Write): đúng
 * `bitmap.bytesPerRow * bitmap.height` byte nhị phân thô ngay sau dấu phẩy
 * cuối, không có tiền tố độ dài hay mã hoá lại dạng hex-ASCII.
 *
 * Cực tính bị đảo ngược so với quy ước chuẩn của `Bitmap` trong package này
 * (MSB-first, bit 1 = đen): `GW` cần 0 = đen, 1 = trắng — đặc thù phần cứng
 * đã được tài liệu hoá của EPL2. Mỗi byte được đảo bit (`^ 0xff`) ngay tại
 * đây để giữ đúng quy ước cực tính chuẩn ở mọi nơi khác trong package.
 */
export function encodeEplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let byteIndex = 0; byteIndex < bitmap.data.length; byteIndex++) {
    // eslint-disable-next-line no-bitwise
    payload += String.fromCharCode(bitmap.data[byteIndex] ^ 0xff);
  }
  return payload;
}
