import type { MonochromeBitmap } from '../../utils/monochromeBitmap';
import { CutterMode } from '../../models/media/PrintMedia';

const INIT_PRINTER_BYTES = [0x1b, 0x40]; // ESC @
const CUT_BYTES = [0x1b, 0x6d]; // khớp hành vi cắt ESC/POS text-mode hiện tại (EPToolkit.cut_bytes)

/**
 * Lệnh raster bit image chuẩn Epson `GS v 0` — width tính theo BYTE (little-
 * endian 2 byte), height theo DOT, theo sau đúng `widthBytes * heightPx` byte
 * nhị phân MSB-first (bit=1 là đen). Định dạng này khớp NGUYÊN VẸN với
 * `MonochromeBitmap.bits` đã có — KHÔNG cần đảo bit như quirk firmware
 * riêng của lệnh `BITMAP` TSPL (đó là lỗi 1 dòng máy clone cụ thể, không áp
 * dụng cho `GS v 0`).
 *
 * Byte cắt `[0x1b, 0x6d]` copy từ hằng số `cut_bytes` trong `EPToolkit.ts`
 * (vendored, không export nên khai lại local ở đây) để giữ đúng hành vi cắt
 * vật lý người dùng đã quen với text-mode hiện tại — chưa xác nhận trên
 * phần cứng thật, cùng mức độ chưa-verify như TSPL truetype/internalfont.
 */
export const buildEscPosBitmapBytes = (bitmap: MonochromeBitmap, cutterMode: CutterMode): Uint8Array => {
  const header = [
    0x1d, 0x76, 0x30, 0x00,
    // eslint-disable-next-line no-bitwise -- intentional low-byte/high-byte split for little-endian width field
    bitmap.widthBytes & 0xff, (bitmap.widthBytes >> 8) & 0xff,
    // eslint-disable-next-line no-bitwise -- intentional low-byte/high-byte split for little-endian height field
    bitmap.heightPx & 0xff, (bitmap.heightPx >> 8) & 0xff,
  ];

  const trailer = cutterMode === CutterMode.none ? [] : CUT_BYTES;

  return new Uint8Array([...INIT_PRINTER_BYTES, ...header, ...bitmap.bits, ...trailer]);
};
