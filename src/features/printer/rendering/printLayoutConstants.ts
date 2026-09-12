/**
 * Hằng số layout dùng chung giữa `TsplTextStrategy` (đơn vị: dot TSPL) và
 * `renderDocumentToBitmap` (đơn vị: pixel canvas Skia) — CÙNG 1 giá trị vì cả
 * 2 đều theo mật độ 8 dot/mm của máy in nhiệt (`DOTS_PER_MM` ở `paper/paperSpec.ts`),
 * không phải trùng hợp: `PAPER_SIZE_SPECS[...].imageWidthPx` đã tính đúng
 * `printableWidthMm * 8` — px và dot LÀ CÙNG 1 đơn vị trong codebase này.
 *
 * `LINE_HEIGHT` ước lượng theo font built-in `"3"` của TSPL (chưa verify
 * trên phần cứng thật, ghi nhận là ước lượng — xem spec §9). `BARCODE_HEIGHT`
 * KHÔNG phải ước lượng: `TsplEncoder.barcode()` hardcode chiều cao `50` dot
 * ngay trong lệnh `BARCODE`, cộng thêm biên nhỏ. `QRCODE_HEIGHT` là ước lượng
 * (kích thước QR thật phụ thuộc độ dài nội dung/version) — v1 không wrap nên
 * chấp nhận tràn nếu QR thật lớn hơn.
 */
export const LINE_HEIGHT_DOTS = 24;
export const BARCODE_HEIGHT_DOTS = 60;
export const QRCODE_HEIGHT_DOTS = 200;
