import type { Bitmap } from '../../types';

/**
 * Mã hoá một bitmap đơn sắc thành payload mà lệnh EPL2 `GW` yêu cầu ngay sau
 * dấu phẩy cuối cùng: đúng `bitmap.bytesPerRow * bitmap.height` byte nhị phân
 * thô, không có tiền tố độ dài hay mã hoá lại dạng hex-ASCII — hai trường
 * `p3`/`p4` (bytes-per-row/height) của `GW` đã cho máy in biết cần đọc bao
 * nhiêu byte tiếp theo, theo lệnh Graphic Write trong EPL2 Programmer's Guide
 * (`GW p1,p2,p3,p4,<data>`) — cùng dạng byte-nhị-phân-sau-dấu-phẩy-cuối như
 * `BITMAP` của TSPL, xem `encodeTscBitmapPayload()` trong `TscEncoder.ts` của
 * package này để đối chiếu cấu trúc.
 *
 * Sửa một lỗi thật trong case image của `languages/epl.ts` bên portakal: nó
 * chỉ phát phần header `GW x,y,bytesPerRow,height` (không dấu phẩy cuối,
 * không payload) — một lệnh không đầy đủ mà không máy in thật nào giải mã
 * được. Cùng loại lỗi mà Phase 1 đã sửa cho `BITMAP` của TSC.
 *
 * Cực tính bị đảo ngược so với quy ước chuẩn của `Bitmap` (MSB-first, bit 1 =
 * đen — quy ước mà `^GF` của `ZplEncoder` và `BITMAP` của `TscEncoder` đều
 * dùng nguyên bản): `GW` cần 0=đen, 1=trắng, theo đúng ghi chú trong file
 * header `src/lang/epl.ts` gốc của portakal ("GW image polarity: INVERTED
 * (0=black, 1=white)") — đây là đặc thù phần cứng đã được tài liệu hoá của
 * EPL2, không phải lỗi của portakal. Mỗi byte được đảo bit (`^ 0xff`) ngay
 * tại điểm dựng payload để gửi đi, để `Bitmap`/`encodeZplBitmapPayload`/
 * `encodeTscBitmapPayload` vẫn giữ đúng một quy ước cực tính chuẩn ở mọi nơi
 * khác trong package, và chỉ riêng định dạng truyền dây thực sự bị đảo cực
 * của `GW` mới cần xử lý đặc biệt.
 */
export function encodeEplBitmapPayload(bitmap: Bitmap): string {
  let payload = '';
  for (let byteIndex = 0; byteIndex < bitmap.data.length; byteIndex++) {
    // Đảo bit có chủ đích để khớp cực tính ngược của GW, xem doc comment ở trên.
    // eslint-disable-next-line no-bitwise
    payload += String.fromCharCode(bitmap.data[byteIndex] ^ 0xff);
  }
  return payload;
}
