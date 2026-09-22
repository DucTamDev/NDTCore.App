import type { Bitmap } from '../../types';

/**
 * Mã hoá bitmap đơn sắc thành payload thô nối sau header của field Graphic
 * (`G`). Mỗi ký tự JS string = 1 byte thô (MSB-first, bit 1 = đen, theo quy
 * ước `Bitmap`), không length prefix, không hex re-encoding.
 *
 * ĐỘ TIN CẬY THẤP: cú pháp clause header (`w`/`h`) đặt trước payload này
 * (ở case `'image'` của `IplCompiler`) CHƯA được xác minh với tài liệu
 * Intermec/Honeywell IPL Programmer's Reference Manual — cần kiểm tra trên
 * máy in thật trước khi phụ thuộc vào đây.
 */
export function encodeIplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    payload += String.fromCharCode(bitmap.data[i]);
  }
  return payload;
}
