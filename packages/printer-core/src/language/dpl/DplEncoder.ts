import type { Bitmap } from '../../types';

/**
 * Payload bản ghi ảnh DPL, đứng ngay sau header `1{col}{row}{h}{w}0005`:
 * đúng `bitmap.bytesPerRow * bitmap.height` byte nhị phân thô (MSB-first,
 * bit 1 = đen, theo quy ước chuẩn của `Bitmap`), không tiền tố độ dài, không
 * mã hoá lại hex-ASCII — header `h`/`w` đã cho máy in biết cần đọc bao nhiêu
 * byte tiếp theo.
 *
 * Trả về `string` (không phải bytes) vì `DplCompiler` dựng cả tài liệu
 * thành một chuỗi — mỗi ký tự tương ứng đúng một byte thô.
 */
export function encodeDplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let byteIndex = 0; byteIndex < bitmap.data.length; byteIndex++) {
    payload += String.fromCharCode(bitmap.data[byteIndex]);
  }
  return payload;
}
