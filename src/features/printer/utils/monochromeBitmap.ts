/** Bitmap 1-bit đã đóng gói theo hàng (row-packed), MSB trước — đúng format lệnh `BITMAP` của TSPL. */
export interface MonochromeBitmap {
  /** Số byte/hàng — TSPL cần width tính theo BYTE, không phải pixel (`Math.ceil(widthPx / 8)`). */
  widthBytes: number;
  heightPx: number;
  /** `bits.length === widthBytes * heightPx`. Bit `1` = đen (in ra), `0` = trắng. */
  bits: Uint8Array;
}

/**
 * Convert RGBA (4 byte/pixel, thứ tự R,G,B,A) sang bitmap 1-bit theo ngưỡng
 * độ sáng (luminance) — cần thiết vì lệnh `BITMAP` của TSPL chỉ nhận ảnh đen
 * trắng thuần, không có khái niệm màu/xám. Pixel trong suốt (alpha=0) luôn
 * tính là trắng (nền), không phụ thuộc màu RGB bên dưới.
 */
export const rgbaToMonochromeBitmap = (
  rgba: Uint8Array,
  widthPx: number,
  heightPx: number,
  threshold = 128,
): MonochromeBitmap => {
  const widthBytes = Math.ceil(widthPx / 8);
  const bits = new Uint8Array(widthBytes * heightPx);

  for (let y = 0; y < heightPx; y += 1) {
    for (let x = 0; x < widthPx; x += 1) {
      const pixelOffset = (y * widthPx + x) * 4;
      const r = rgba[pixelOffset];
      const g = rgba[pixelOffset + 1];
      const b = rgba[pixelOffset + 2];
      const a = rgba[pixelOffset + 3];
      const luminance = a === 0 ? 255 : (r * 299 + g * 587 + b * 114) / 1000;
      if (luminance >= threshold) continue;

      // eslint-disable-next-line no-bitwise -- intentional bit packing, MSB-first per pixel row (TSPL BITMAP format)
      const byteIndex = y * widthBytes + (x >> 3);
      // eslint-disable-next-line no-bitwise -- intentional bit packing, MSB-first per pixel row (TSPL BITMAP format)
      const bitMask = 1 << (7 - (x % 8));
      // eslint-disable-next-line no-bitwise -- intentional bit packing, MSB-first per pixel row (TSPL BITMAP format)
      bits[byteIndex] |= bitMask;
    }
  }

  return { widthBytes, heightPx, bits };
};
