/** Đổi theo ngưỡng: điểm dưới `threshold` thành đen (0), còn lại trắng (255). */
export function ditherThreshold(
  gray: Uint8Array,
  width: number,
  height: number,
  threshold = 128,
): Uint8Array {
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = gray[i]! < threshold ? 0 : 255;
  }
  return out;
}
