import UPNG from 'upng-js';
import { Buffer } from 'buffer';
import { rgbaToMonochromeBitmap, type MonochromeBitmap } from './monochromeBitmap';

/**
 * Thu nhỏ RGBA (nearest-neighbor) về đúng `targetWidthPx`, giữ tỉ lệ —
 * `react-native-view-shot` chụp theo pixel vật lý thật của máy (dp ×
 * devicePixelRatio), không phải dp, nên ảnh decode được thường lớn hơn
 * `targetWidthPx` (khớp `PAPER_SIZE_SPECS[...].imageWidthPx`) 2-3 lần trên máy pixelRatio
 * cao. Làm ở đây (thuần JS, dựa trên kích thước ảnh đã decode) thay vì nhờ
 * `captureRef({width, height})` vì option đó cần đọc `onLayout` — 1 sự kiện
 * có thể bắn nhiều lần với kích thước tạm trước khi `Text` con đo xong,
 * từng gây ảnh trắng trơn/lẫn nội dung lần chụp trước.
 */
const downscaleRgba = (
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
): { data: Uint8Array; width: number; height: number } => {
  const scale = srcWidth / targetWidth;
  const targetHeight = Math.max(1, Math.round(srcHeight / scale));
  const data = new Uint8Array(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const srcY = Math.min(srcHeight - 1, Math.floor(y * scale));
    for (let x = 0; x < targetWidth; x += 1) {
      const srcX = Math.min(srcWidth - 1, Math.floor(x * scale));
      const srcOffset = (srcY * srcWidth + srcX) * 4;
      const dstOffset = (y * targetWidth + x) * 4;
      data[dstOffset] = src[srcOffset];
      data[dstOffset + 1] = src[srcOffset + 1];
      data[dstOffset + 2] = src[srcOffset + 2];
      data[dstOffset + 3] = src[srcOffset + 3];
    }
  }
  return { data, width: targetWidth, height: targetHeight };
};

/**
 * Decode 1 ảnh PNG (base64, không có tiền tố `data:image/png;base64,`) sang
 * bitmap 1-bit — dùng cho `TsplEncoder.image()`. `upng-js` là decoder PNG
 * thuần JS (không cần Canvas/native module), phù hợp môi trường RN vốn
 * không có `HTMLCanvasElement`. `UPNG.toRGBA8()` chỉ trả `ArrayBuffer[]`
 * (nhiều frame cho APNG) — bill chỉ có 1 frame tĩnh nên luôn lấy `[0]`.
 *
 * `targetWidthPx` — nếu truyền và khác `decoded.width` (xem `downscaleRgba`
 * ở trên), resize RGBA về đúng chiều rộng này trước khi threshold. Bỏ trống
 * khi không cần chuẩn hoá kích thước (vd test tự build PNG đúng sẵn kích thước).
 */
export const decodePngBase64ToMonochrome = (
  base64Png: string,
  targetWidthPx?: number,
  threshold = 128,
): MonochromeBitmap => {
  const pngBytes = Buffer.from(base64Png, 'base64');
  const decoded = UPNG.decode(pngBytes);
  const [rgbaBuffer] = UPNG.toRGBA8(decoded);
  const rgba = new Uint8Array(rgbaBuffer);
  if (targetWidthPx && decoded.width !== targetWidthPx) {
    const resized = downscaleRgba(rgba, decoded.width, decoded.height, targetWidthPx);
    return rgbaToMonochromeBitmap(resized.data, resized.width, resized.height, threshold);
  }
  return rgbaToMonochromeBitmap(rgba, decoded.width, decoded.height, threshold);
};
