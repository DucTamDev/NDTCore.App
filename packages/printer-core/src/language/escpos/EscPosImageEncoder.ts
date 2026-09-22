import type { Bitmap } from '../../types';
import { ESC_POS, concatEscPosBytes } from './EscPosCommand';

/** Giá trị "n" của ESC 3 n — tắt line spacing để các dòng ảnh in liền nhau, không cách dòng text. */
const LINE_SPACING_OVERRIDE = 0;

/** Giá trị "m" của GS v 0 m — chế độ raster bình thường (không nhân đôi width/height). */
const RASTER_IMAGE_NORMAL_MODE = 0;

/**
 * Encode bitmap đơn sắc thành ảnh raster ESC/POS ("GS v 0"), bọc trong cặp lệnh
 * line-spacing override để các dòng ảnh in liền nhau thay vì cách theo line spacing text.
 */
export function encodeEscPosImage(bitmap: Bitmap): Uint8Array {
  // Tách chiều rộng/chiều cao thành cặp byte little-endian, theo wire format của GS v 0.
  // eslint-disable-next-line no-bitwise
  const xL = bitmap.bytesPerRow & 0xff;
  // eslint-disable-next-line no-bitwise
  const xH = (bitmap.bytesPerRow >> 8) & 0xff;
  // eslint-disable-next-line no-bitwise
  const yL = bitmap.height & 0xff;
  // eslint-disable-next-line no-bitwise
  const yH = (bitmap.height >> 8) & 0xff;

  const header = new Uint8Array([
    ESC_POS.ESC,
    ESC_POS.LINE_SPACING_SET,
    LINE_SPACING_OVERRIDE,
    ESC_POS.GS,
    ESC_POS.RASTER_IMAGE[0],
    ESC_POS.RASTER_IMAGE[1],
    RASTER_IMAGE_NORMAL_MODE,
    xL,
    xH,
    yL,
    yH,
  ]);
  const footer = new Uint8Array([ESC_POS.ESC, ESC_POS.LINE_SPACING_DEFAULT]);

  return concatEscPosBytes([header, bitmap.data, footer]);
}
