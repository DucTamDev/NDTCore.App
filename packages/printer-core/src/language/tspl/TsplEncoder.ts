import type { Bitmap } from '../../types';

/**
 * Payload lệnh TSPL2 `BITMAP`: đúng `bytesPerRow * height` byte nhị phân
 * thô (MSB trước, bit 1 = đen), không hex-encode, không tiền tố độ dài —
 * hai trường header đã đủ để máy in biết đọc tiếp bao nhiêu byte. Mỗi byte
 * được giữ làm 1 char code (latin-1) khi nối vào chuỗi lệnh.
 */
export function encodeTsplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    payload += String.fromCharCode(bitmap.data[i]);
  }
  return payload;
}
