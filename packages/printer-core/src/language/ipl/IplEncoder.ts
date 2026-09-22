import type { Bitmap } from '../../types';

/**
 * Mã hoá một bitmap đơn sắc thành payload thô nối sau header của field
 * Graphic (`G`) trong IPL. Mỗi ký tự JS string tương ứng 1 byte thô
 * (MSB-first, bit 1 = đen — theo đúng quy ước chuẩn của `Bitmap`, không
 * chỉnh sửa gì), không có length prefix, không hex re-encoding — cùng quy
 * ước "1 ký tự = 1 byte" mà `DplEncoder.ts`/`EplEncoder.ts`'s
 * `encode*BitmapPayload()` dùng, vì `IplCompiler` dựng toàn bộ document
 * thành một `string`, không phải bytes.
 *
 * ĐỘ TIN CẬY — THẤP, cần xác minh trên máy in thật trước khi dựa vào đây.
 * Khác với EPL và DPL — nơi case image gốc của portakal ít nhất còn có
 * hình dạng header hợp lý và chỉ thiếu payload — case image trong
 * `languages/ipl.ts` của portakal gần như là một stub: nó chỉ emit
 * `{STX}G{fieldNum};o{x},{y};f0{ETX}` — không width, không height, không
 * data gì cả — nên không có "ground truth" nào từ portakal để suy ra cách
 * bố trí clause thật của field Graphic.
 *
 * Encoder này (và nơi gọi nó — case `'image'` của `IplCompiler`, thêm
 * `;w{bytesPerRow};h{height};` trước payload) là một sự tái dựng, không
 * phải một bản port đã xác minh: nó mở rộng đoạn header đã biết của
 * portakal theo đúng cú pháp clause một-chữ-cái-phân-tách-bởi-`;` mà field
 * `H` (text) và `W` (box) trong codebase này đã dùng cho kích thước của
 * chúng, dựa trên lý lẽ rằng một ngôn ngữ máy in nhất quán về cú pháp field
 * như vậy nhiều khả năng cũng áp dụng cú pháp đó cho field graphic. Lý lẽ
 * này hợp lý nhưng CHƯA được xác nhận với tài liệu Intermec/Honeywell IPL
 * Programmer's Reference Manual — tên field thật, các chữ cái clause, thứ
 * tự clause, và cách bố trí byte có thể khác với những gì được implement
 * ở đây.
 *
 * Điều CHẮC CHẮN: lỗi gốc — portakal hoàn toàn thiếu width/height/payload
 * trong case image — đã được sửa. Dữ liệu bitmap thật, chính xác từng byte,
 * giờ theo sau header, khớp `bitmap.data`. Hãy xem cú pháp lệnh hiện tại là
 * một placeholder nhất quán, có ghi chú rõ ràng, chờ xác minh bằng phần
 * cứng/tài liệu chính thức — chưa phải wire format đã được xác nhận.
 */
export function encodeIplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let i = 0; i < bitmap.data.length; i++) {
    payload += String.fromCharCode(bitmap.data[i]);
  }
  return payload;
}
