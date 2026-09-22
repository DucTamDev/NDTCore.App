import type { Bitmap } from '../../types';
import { BITS_PER_BYTE, BYTE_MASK, STAR_PRNT, concatStarPrntBytes } from './StarPrntCommand';

/**
 * Mã hoá 1 bitmap đơn sắc thành ảnh raster Star Line Mode: vào chế độ raster,
 * phát 1 bản ghi "b nL nH data" cho mỗi hàng ảnh, rồi thoát chế độ raster.
 * Khác với header ảnh nguyên khối "GS v 0" của ESC/POS, raster Star xử lý
 * theo từng hàng.
 */
export function encodeStarPrntImage(bitmap: Bitmap): Uint8Array {
  const chunks: Uint8Array[] = [new Uint8Array([STAR_PRNT.ESC, ...STAR_PRNT.RASTER_ENTER])];

  for (let y = 0; y < bitmap.height; y++) {
    // Tách bytesPerRow thành cặp byte little-endian (nL, nH), theo định dạng
    // "b nL nH data" của Star Line Mode.
    // eslint-disable-next-line no-bitwise
    const nL = bitmap.bytesPerRow & BYTE_MASK;
    // eslint-disable-next-line no-bitwise
    const nH = (bitmap.bytesPerRow >> BITS_PER_BYTE) & BYTE_MASK;
    const rowStart = y * bitmap.bytesPerRow;
    chunks.push(new Uint8Array([STAR_PRNT.RASTER_LINE, nL, nH]));
    chunks.push(bitmap.data.slice(rowStart, rowStart + bitmap.bytesPerRow));
  }

  chunks.push(new Uint8Array([STAR_PRNT.ESC, ...STAR_PRNT.RASTER_EXIT]));

  return concatStarPrntBytes(chunks);
}
