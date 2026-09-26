/**
 * Đổi RGBA thành ảnh xám 1 kênh. Giấy in nhiệt không có trong suốt, nên điểm trong suốt được phủ lên nền trắng trước
 * khi tính độ sáng theo trọng số BT.601.
 */
export function rgbaToGrayscale(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    const a = rgba[i * 4 + 3]!;
    // Càng trong suốt càng gần màu trắng của giấy.
    const rr = (r * a + 255 * (255 - a)) / 255;
    const gg = (g * a + 255 * (255 - a)) / 255;
    const bb = (b * a + 255 * (255 - a)) / 255;
    // Mắt người nhạy với xanh lá nhất, xanh dương kém nhất.
    gray[i] = Math.round(0.299 * rr + 0.587 * gg + 0.114 * bb);
  }
  return gray;
}

/** Tên khác của {@link rgbaToGrayscale}. */
export function toGrayscale(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  return rgbaToGrayscale(rgba, width, height);
}
